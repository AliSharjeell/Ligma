// AI Intent Extraction for LIMA

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

interface IntentRule {
  pattern: RegExp;
  type: IntentType;
  weight: number;
}

const ACTION_ITEM_PATTERNS: IntentRule[] = [
  { pattern: /\b(todo|task|action|need to|should|must|will|going to)\b/i, type: 'action_item', weight: 1.0 },
  { pattern: /\b(assign|delegate|responsible|handle)\b/i, type: 'action_item', weight: 0.9 },
  { pattern: /^\s*[-*]\s*/m, type: 'action_item', weight: 0.8 },
  { pattern: /\b(fix|implement|create|build|develop|design)\b/i, type: 'action_item', weight: 0.85 },
  { pattern: /\bdeadline|due|by\s+\w+/i, type: 'action_item', weight: 0.75 }
];

const DECISION_PATTERNS: IntentRule[] = [
  { pattern: /\b(decided|agreed|approved|confirmed|accepted|rejected)\b/i, type: 'decision', weight: 1.0 },
  { pattern: /\b(resolved|concluded|final|decided that)\b/i, type: 'decision', weight: 0.95 },
  { pattern: /\b(voted|passed|approved)\s+(on|for|to)\b/i, type: 'decision', weight: 0.9 },
  { pattern: /\bwe\s+(will|shall|are|have)\s+(decided|agreed|decided)\b/i, type: 'decision', weight: 0.95 }
];

const QUESTION_PATTERNS: IntentRule[] = [
  { pattern: /\b(\?|how|what|why|when|where|who|should we|can we|could we)\b/i, type: 'open_question', weight: 1.0 },
  { pattern: /\b(unsure|unclear|need clarification|tbd|to be determined)\b/i, type: 'open_question', weight: 0.9 },
  { pattern: /\b(thoughts?|ideas?|feedback|input)\s+\?\s*/i, type: 'open_question', weight: 0.85 },
  { pattern: /\b，讨论\b|\b需确认\b|\b待定\b/u, type: 'open_question', weight: 0.8 }
];

const REFERENCE_PATTERNS: IntentRule[] = [
  { pattern: /\b(link|reference|url|see|check|look at|document|linkedin|github|figma)\b/i, type: 'reference', weight: 1.0 },
  { pattern: /\b(previous|earlier|above|mentioned|noted|as discussed)\b/i, type: 'reference', weight: 0.8 },
  { pattern: /\b(wiki|readme|ticket|issue|pr|merge)\b/i, type: 'reference', weight: 0.85 },
  { pattern: /^https?:\/\//m, type: 'reference', weight: 0.95 }
];

export class IntentExtractor {
  private rules: IntentRule[];

  constructor() {
    this.rules = [
      ...ACTION_ITEM_PATTERNS,
      ...DECISION_PATTERNS,
      ...QUESTION_PATTERNS,
      ...REFERENCE_PATTERNS
    ];
  }

  analyze(content: string): ExtractedIntent {
    const scores: Record<IntentType, number> = {
      action_item: 0,
      decision: 0,
      open_question: 0,
      reference: 0
    };

    const matchedKeywords: string[] = [];

    for (const rule of this.rules) {
      const matches = content.match(rule.pattern);
      if (matches) {
        scores[rule.type] += rule.weight * matches.length;
        matchedKeywords.push(...matches);
      }
    }

    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const topType = (Object.entries(scores).reduce(
      (best, current) => (current[1] > best[1] ? current : best),
      ['action_item' as IntentType, 0] as [IntentType, number]
    )[0]);

    const confidence = totalScore > 0 ? scores[topType as IntentType] / totalScore : 0.5;

    const result: ExtractedIntent = {
      type: topType as IntentType,
      confidence: Math.min(1, confidence),
      keywords: [...new Set(matchedKeywords.map(k => k.toLowerCase()))].slice(0, 10),
      extractedContent: this.extractRelevantContent(content, topType as IntentType)
    };

    if (topType === 'action_item' && this.extractTask(content)) {
      result.suggestedTask = this.extractTask(content)!;
    }

    return result;
  }

  private extractRelevantContent(content: string, type: IntentType): string {
    const lines = content.split('\n');

    switch (type) {
      case 'action_item':
        return lines.find(line =>
          ACTION_ITEM_PATTERNS.some(p => p.pattern.test(line))
        ) || content.slice(0, 200);
      case 'decision':
        return lines.find(line =>
          DECISION_PATTERNS.some(p => p.pattern.test(line))
        ) || content.slice(0, 200);
      case 'open_question':
        return content.includes('?') ? content : content.slice(0, 200);
      case 'reference':
        return lines.filter(line => REFERENCE_PATTERNS.some(p => p.pattern.test(line))).join('\n') || content.slice(0, 200);
      default:
        return content.slice(0, 200);
    }
  }

  private extractTask(content: string): ExtractedIntent['suggestedTask'] | undefined {
    const assigneeMatch = content.match(/@(\w+)/);
    const dueDateMatch = content.match(/(?:due|by|deadline)\s*:?\s*(\d{4}-\d{2}-\d{2}|\w+\s+\d+)/i);

    const actionableLines = content.split('\n').filter(line =>
      ACTION_ITEM_PATTERNS.some(p => p.pattern.test(line))
    );

    if (actionableLines.length > 0) {
      return {
        title: actionableLines[0].replace(/^[-*]\s*/, '').trim().slice(0, 100),
        description: content.slice(0, 500),
        ...(assigneeMatch && { assignee: assigneeMatch[1] }),
        ...(dueDateMatch && { dueDate: dueDateMatch[1] })
      };
    }

    return undefined;
  }

  batchAnalyze(contents: string[]): ExtractedIntent[] {
    return contents.map(c => this.analyze(c));
  }
}

export interface TaskBoardEntry {
  id: string;
  nodeId: string;
  title: string;
  description: string | undefined;
  status: 'pending' | 'in_progress' | 'completed';
  assignee?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
  createdAt: number;
  canvasId: string;
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