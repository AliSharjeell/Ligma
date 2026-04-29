// AI Summary Generator using Groq Vision + LLM

import 'dotenv/config';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

export interface CanvasSummaryInput {
  elements: Array<{
    id: string;
    type: string;
    content: string;
    position: { x: number; y: number };
    color?: string;
    textStyle?: Record<string, unknown>;
    shapeType?: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    description?: string;
    status: string;
    priority?: string;
    intentType?: string;
  }>;
  users: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  activityLog: Array<{
    type: string;
    details?: string;
    userName: string;
    timestamp: number;
  }>;
}

export interface GeneratedSummary {
  overview: string;
  decisions: string[];
  actionItems: string[];
  openQuestions: string[];
  references: string[];
  nextSteps: string[];
  participants: string[];
  generatedAt: string;
}

const SYSTEM_PROMPT = `You are an expert meeting summarizer for a collaborative canvas application. Given canvas data including sticky notes, text, drawings, tasks, and activity logs, generate a comprehensive summary.

Return ONLY a JSON object with this exact format (no markdown, no explanation):
{
  "overview": "2-3 sentence summary of the canvas/meeting topic",
  "decisions": ["Decision 1", "Decision 2"],
  "actionItems": ["Action item 1", "Action item 2"],
  "openQuestions": ["Open question 1", "Open question 2"],
  "references": ["Reference 1", "Reference 2"],
  "nextSteps": ["Next step 1", "Next step 2"],
  "participants": ["Name1", "Name2"]
}`;

export class SummaryGenerator {
  private cache: Map<string, { summary: GeneratedSummary; timestamp: number }> = new Map();
  private cacheTimeout = 60000; // 1 minute cache

  async generateSummary(input: CanvasSummaryInput): Promise<GeneratedSummary> {
    // Create cache key from content
    const cacheKey = this.createCacheKey(input);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.summary;
    }

    // Prepare data for the model
    const dataSummary = this.prepareDataSummary(input);

    // If no meaningful content, return empty summary
    if (!dataSummary.content) {
      return {
        overview: 'No content available to summarize.',
        decisions: [],
        actionItems: [],
        openQuestions: [],
        references: [],
        nextSteps: [],
        participants: input.users.map(u => u.name),
        generatedAt: new Date().toISOString()
      };
    }

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant', // Use fast model for summary
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Summarize this canvas data:\n\n${dataSummary.content}` }
          ],
          temperature: 0.3,
          max_tokens: 1024
        })
      });

      if (!response.ok) {
        console.error('Groq API error:', response.status, await response.text());
        return this.fallbackGenerate(input);
      }

      const jsonData = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const result = jsonData.choices?.[0]?.message?.content?.trim();

      if (!result) {
        return this.fallbackGenerate(input);
      }

      // Parse JSON response
      try {
        const parsed = JSON.parse(result);
        const summary: GeneratedSummary = {
          overview: parsed.overview || 'Summary generated.',
          decisions: parsed.decisions || [],
          actionItems: parsed.actionItems || [],
          openQuestions: parsed.openQuestions || [],
          references: parsed.references || [],
          nextSteps: parsed.nextSteps || [],
          participants: parsed.participants || input.users.map(u => u.name),
          generatedAt: new Date().toISOString()
        };

        // Cache the result
        this.cache.set(cacheKey, { summary, timestamp: Date.now() });
        return summary;
      } catch {
        console.error('Failed to parse summary JSON:', result);
        return this.fallbackGenerate(input);
      }
    } catch (error) {
      console.error('Summary generation error:', error);
      return this.fallbackGenerate(input);
    }
  }

  private prepareDataSummary(input: CanvasSummaryInput): { content: string } {
    const lines: string[] = [];

    // Add participants
    if (input.users.length > 0) {
      lines.push(`PARTICIPANTS: ${input.users.map(u => `${u.name} (${u.role})`).join(', ')}`);
    }

    // Add canvas overview with element counts
    const textElements = input.elements.filter(e => e.type === 'sticky' || e.type === 'text');
    const shapes = input.elements.filter(e => e.type === 'shape');
    const drawings = input.elements.filter(e => e.type === 'drawing');

    lines.push(`\nCANVAS OVERVIEW:`);
    lines.push(`- ${textElements.length} text elements (sticky notes, text blocks)`);
    lines.push(`- ${shapes.length} shapes`);
    lines.push(`- ${drawings.length} freehand drawings`);

    // Add text content
    if (textElements.length > 0) {
      lines.push('\nTEXT CONTENT:');
      textElements.forEach((el, i) => {
        if (el.content) {
          lines.push(`[${i + 1}] [${el.type}] ${el.content}`);
        }
      });
    }

    // Add shape descriptions
    if (shapes.length > 0) {
      lines.push('\nSHAPES:');
      const shapeCounts = shapes.reduce((acc, s) => {
        const type = s.shapeType || 'rectangle';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(shapeCounts).forEach(([type, count]) => {
        lines.push(`- ${count}x ${type}`);
      });

      // Add any shapes with labels
      shapes.filter(s => s.content).forEach((s, i) => {
        lines.push(`  Label: ${s.content}`);
      });
    }

    // Add drawing info
    if (drawings.length > 0) {
      lines.push(`\nDRAWINGS: ${drawings.length} freehand sketch(es)`);
    }

    // Add tasks grouped by intent type
    if (input.tasks.length > 0) {
      lines.push('\nTASKS:');
      const grouped = input.tasks.reduce((acc, task) => {
        const type = task.intentType || 'action_item';
        if (!acc[type]) acc[type] = [];
        acc[type].push(task);
        return acc;
      }, {} as Record<string, typeof input.tasks>);

      Object.entries(grouped).forEach(([type, tasks]) => {
        lines.push(`\n${type.toUpperCase().replace('_', ' ')}:`);
        tasks.forEach(task => {
          const status = `[${task.status}]`;
          lines.push(`- ${status} ${task.title}${task.description ? `: ${task.description}` : ''}`);
        });
      });
    }

    // Add recent activity
    if (input.activityLog.length > 0) {
      lines.push('\nRECENT ACTIVITY:');
      input.activityLog.slice(0, 20).forEach(log => {
        lines.push(`- ${log.userName}: ${log.details || log.type}`);
      });
    }

    const content = lines.join('\n');
    return { content: content.slice(0, 4000) }; // Limit to 4000 chars
  }

  private fallbackGenerate(input: CanvasSummaryInput): GeneratedSummary {
    // Simple fallback if API fails
    const tasks = input.tasks || [];
    const elements = input.elements || [];

    return {
      overview: this.generateOverview(input),
      decisions: tasks.filter(t => t.intentType === 'decision').map(t => t.title),
      actionItems: tasks.filter(t => !t.intentType || t.intentType === 'action_item').map(t => t.title),
      openQuestions: tasks.filter(t => t.intentType === 'open_question').map(t => t.title),
      references: elements.filter(e => e.content?.match(/https?:\/\//)).map(e => e.content),
      nextSteps: tasks.filter(t => t.status !== 'completed').map(t => t.title),
      participants: input.users.map(u => u.name),
      generatedAt: new Date().toISOString()
    };
  }

  private generateOverview(input: CanvasSummaryInput): string {
    const elements = input.elements || [];
    const tasks = input.tasks || [];
    const users = input.users || [];

    const textContent = elements
      .filter(e => e.content)
      .map(e => e.content)
      .slice(0, 5)
      .join('. ');

    const taskCount = tasks.length;
    const completedCount = tasks.filter(t => t.status === 'completed').length;
    const participantCount = users.length;

    if (textContent) {
      return `Canvas with ${elements.length} elements, ${taskCount} tasks (${completedCount} completed), and ${participantCount} participants. Content: ${textContent.slice(0, 200)}...`;
    }
    return `Canvas session with ${taskCount} tasks across ${participantCount} participants. ${completedCount} tasks completed.`;
  }

  private createCacheKey(input: CanvasSummaryInput): string {
    const contentHash = input.elements
      .filter(e => e.content)
      .map(e => e.content)
      .join('|')
      .slice(0, 500);
    const taskHash = input.tasks.map(t => `${t.id}:${t.title}:${t.status}`).join('|');
    return `${contentHash}::${taskHash}`;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const summaryGenerator = new SummaryGenerator();