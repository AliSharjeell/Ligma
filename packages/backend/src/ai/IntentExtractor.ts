// AI Intent Extraction for LIMA using Groq API

export type IntentType = 'action_item' | 'decision' | 'open_question' | 'reference';

export interface ExtractedIntent {
  type: IntentType;
  confidence: number;
  keywords: string[];
  extractedContent: string;
  suggestedTask?: {
    title: string;
    description: string;
    assignee?: string;
    dueDate?: string;
  };
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const MODEL = 'llama-3.1-8b-instant'; // Fast and cheap model

const SYSTEM_PROMPT = `You are an intent classifier for a collaborative canvas application. Analyze the user's text and classify it into one of these categories:

- "action_item": Tasks, todos, things that need to be done, assignments, deadlines
- "decision": Agreed decisions, resolutions, conclusions, approved plans
- "open_question": Questions, uncertain items, things needing discussion or clarification
- "reference": Links, documents, references to other resources or previous discussions

Return ONLY a JSON object with this exact format (no markdown, no explanation):
{"type": "action_item|decision|open_question|reference", "confidence": 0.0-1.0, "reason": "brief reason", "title": "task title if action_item, otherwise empty string"}`;

export class IntentClassifier {
  private cache: Map<string, ExtractedIntent> = new Map();
  private maxCacheSize = 100;

  async classify(content: string): Promise<ExtractedIntent> {
    // Check cache first
    const cacheKey = content.slice(0, 200).toLowerCase().trim();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // If content is very short or empty, return default
    if (!content || content.trim().length < 3) {
      return {
        type: 'reference',
        confidence: 0.5,
        keywords: [],
        extractedContent: content.slice(0, 200)
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
          model: MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Classify this text: "${content.slice(0, 500)}"` }
          ],
          temperature: 0.1,
          max_tokens: 150
        })
      });

      if (!response.ok) {
        console.error('Groq API error:', response.status, await response.text());
        return this.fallbackClassify(content);
      }

      const jsonData = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const result = jsonData.choices?.[0]?.message?.content?.trim();

      if (!result) {
        return this.fallbackClassify(content);
      }

      // Parse the JSON response
      let parsed: { type: string; confidence: number; reason: string; title?: string };
      try {
        parsed = JSON.parse(result);
      } catch {
        console.error('Failed to parse LLM response:', result);
        return this.fallbackClassify(content);
      }

      // Validate and normalize the type
      const validTypes: IntentType[] = ['action_item', 'decision', 'open_question', 'reference'];
      const type = validTypes.includes(parsed.type as IntentType)
        ? parsed.type as IntentType
        : 'reference';

      const intent: ExtractedIntent = {
        type,
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.7)),
        keywords: [],
        extractedContent: content.slice(0, 200)
      };

      // If action item, generate suggested task
      if (type === 'action_item') {
        intent.suggestedTask = {
          title: parsed.title || this.extractTitle(content),
          description: content.slice(0, 500)
        };
      }

      // Cache the result
      this.cacheResult(cacheKey, intent);

      return intent;
    } catch (error) {
      console.error('Intent classification error:', error);
      return this.fallbackClassify(content);
    }
  }

  private fallbackClassify(content: string): ExtractedIntent {
    // Simple regex-based fallback
    const lower = content.toLowerCase();

    if (/\b(todo|task|need to|should|must|will do|going to|assign|deadline|due)\b/i.test(lower)) {
      return {
        type: 'action_item',
        confidence: 0.6,
        keywords: [],
        extractedContent: content.slice(0, 200),
        suggestedTask: {
          title: this.extractTitle(content),
          description: content.slice(0, 500)
        }
      };
    }

    if (/\b(decided|agreed|approved|resolved|concluded)\b/i.test(lower)) {
      return {
        type: 'decision',
        confidence: 0.6,
        keywords: [],
        extractedContent: content.slice(0, 200)
      };
    }

    if (/\?|how|what|why|when|should we|can we/i.test(lower)) {
      return {
        type: 'open_question',
        confidence: 0.6,
        keywords: [],
        extractedContent: content.slice(0, 200)
      };
    }

    return {
      type: 'reference',
      confidence: 0.5,
      keywords: [],
      extractedContent: content.slice(0, 200)
    };
  }

  private extractTitle(content: string): string {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length > 0) {
      return lines[0].replace(/^[-*•]\s*/, '').trim().slice(0, 100);
    }
    return content.slice(0, 100).trim();
  }

  private cacheResult(key: string, intent: ExtractedIntent): void {
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, intent);
  }

  // Synchronous analyze for backward compatibility (uses fallback)
  analyze(content: string): ExtractedIntent {
    return this.fallbackClassify(content);
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// Keep TaskBoard export for convenience
export interface TaskBoardEntry {
  id: string;
  nodeId: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  assignee?: string;
  authorId?: string;
  authorName?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
  createdAt: number;
  canvasId: string;
  intentType?: IntentType;
}

export class TaskBoard {
  private tasks: Map<string, TaskBoardEntry> = new Map();

  addTask(entry: Omit<TaskBoardEntry, 'id' | 'createdAt'>): TaskBoardEntry {
    const task: TaskBoardEntry = {
      ...entry,
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now()
    };
    this.tasks.set(task.id, task);
    return task;
  }

  getTasksByCanvas(canvasId: string): TaskBoardEntry[] {
    return Array.from(this.tasks.values()).filter(t => t.canvasId === canvasId);
  }

  updateTaskStatus(taskId: string, status: TaskBoardEntry['status']): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    task.status = status;
    return true;
  }

  getTask(taskId: string): TaskBoardEntry | undefined {
    return this.tasks.get(taskId);
  }

  getPendingTasks(canvasId: string): TaskBoardEntry[] {
    return this.getTasksByCanvas(canvasId).filter(t => t.status === 'pending');
  }

  deleteTask(taskId: string): boolean {
    return this.tasks.delete(taskId);
  }
}