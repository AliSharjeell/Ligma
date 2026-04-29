// RAG Chat Service for Ligma Canvas

import 'dotenv/config';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface RagChatInput {
  query: string;
  context: string; // RAG context (canvas summary)
  conversationHistory?: ChatMessage[];
  screenshot?: string; // Base64 screenshot for vision analysis
}

export interface RagChatResponse {
  answer: string;
  sources?: string[];
  error?: string;
}

const SYSTEM_PROMPT = `You are a helpful assistant for a collaborative canvas application called Ligma. You have access to the canvas data including:

- Canvas content (sticky notes, text elements, shapes, drawings)
- Tasks and action items
- Decisions made
- Open questions
- Participants
- Activity logs

Use this context to answer user questions accurately. If the answer is not in the context, say so honestly. Be concise and helpful.

IMPORTANT:
- Only answer questions related to the canvas content.
- If a question is unrelated, politely redirect to canvas topics.
- Never mention "RAG", "retrieval", "augmented", or "context window" in your responses - just answer the question naturally.`;

// Store canvas summaries for RAG
const canvasSummaries: Map<string, {
  summary: string;
  elements: Array<{ type: string; content: string }>;
  tasks: Array<{ title: string; status: string; intentType?: string }>;
  updatedAt: number;
}> = new Map();

export class RagChatService {
  // Update the RAG context for a canvas
  updateCanvasContext(
    canvasId: string,
    summary: {
      overview?: string;
      decisions?: string[];
      actionItems?: string[];
      openQuestions?: string[];
      references?: string[];
      participants?: string[];
    },
    elements: Array<{ type: string; content: string }>,
    tasks: Array<{ title: string; status: string; intentType?: string; description?: string }>
  ): void {
    const contextParts: string[] = [];

    if (summary.overview) {
      contextParts.push(`OVERVIEW: ${summary.overview}`);
    }

    if (summary.decisions?.length) {
      contextParts.push(`DECISIONS:\n${summary.decisions.map(d => `- ${d}`).join('\n')}`);
    }

    if (summary.actionItems?.length) {
      contextParts.push(`ACTION ITEMS:\n${summary.actionItems.map(a => `- ${a}`).join('\n')}`);
    }

    if (summary.openQuestions?.length) {
      contextParts.push(`OPEN QUESTIONS:\n${summary.openQuestions.map(q => `- ${q}`).join('\n')}`);
    }

    if (elements.length) {
      contextParts.push(`CANVAS CONTENT:\n${elements.map(e => `- [${e.type}] ${e.content}`).join('\n')}`);
    }

    if (tasks.length) {
      contextParts.push(`TASKS:\n${tasks.map(t => `- [${t.status}] ${t.title}${t.description ? `: ${t.description}` : ''}`).join('\n')}`);
    }

    canvasSummaries.set(canvasId, {
      summary: contextParts.join('\n\n'),
      elements,
      tasks,
      updatedAt: Date.now()
    });
  }

  // Get RAG context for a canvas
  getCanvasContext(canvasId: string): string {
    const data = canvasSummaries.get(canvasId);
    return data?.summary || 'No canvas data available yet.';
  }

  // Generate RAG-based chat response
  async generateResponse(input: RagChatInput): Promise<RagChatResponse> {
    try {
      const context = input.context || 'No context available. Please generate a summary first.';

      // Use multimodal content type if screenshot is provided
      type MessageContent = string | Array<{ type: string; text?: string; image_url?: { url: string } }>;

      const messages: Array<{ role: string; content: MessageContent }> = [
        { role: 'system', content: SYSTEM_PROMPT },
      ];

      // Add conversation history
      if (input.conversationHistory?.length) {
        input.conversationHistory.forEach(msg => {
          messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          });
        });
      }

      // Add canvas context
      messages.push({
        role: 'system',
        content: `CANVAS DATA:\n${context}`
      });

      // Add current query - include screenshot if available for vision analysis
      let userContent: MessageContent = input.query;

      if (input.screenshot) {
        // Use multimodal content with screenshot for vision-capable responses
        userContent = [
          { type: 'text', text: input.query },
          {
            type: 'image_url',
            image_url: {
              url: input.screenshot
            }
          }
        ];
      }

      messages.push({
        role: 'user',
        content: userContent
      });

      // Use vision-capable model if screenshot is provided, otherwise use fast model
      const model = input.screenshot ? 'llama-3.2-11b-vision-preview' : 'llama-3.1-8b-instant';

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 1024
        })
      });

      if (!response.ok) {
        console.error('Groq API error:', response.status, await response.text());
        return { answer: 'Sorry, I encountered an error processing your request.', error: 'API error' };
      }

      const jsonData = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const answer = jsonData.choices?.[0]?.message?.content?.trim() || 'I could not generate a response.';

      return { answer, sources: ['Canvas'] };
    } catch (error) {
      console.error('RAG chat error:', error);
      return { answer: 'Sorry, I encountered an error. Please try again.', error: String(error) };
    }
  }

  // Update canvas from SocketHandler
  updateFromSummary(
    canvasId: string,
    summary: {
      overview?: string;
      decisions?: string[];
      actionItems?: string[];
      openQuestions?: string[];
      participants?: string[];
    },
    elements: Array<{ type: string; content: string }>,
    tasks: Array<{ title: string; status: string; intentType?: string; description?: string }>
  ): void {
    this.updateCanvasContext(canvasId, summary, elements, tasks);
  }
}

export const ragChatService = new RagChatService();