'use client';

import React, { useState, useCallback } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { Button } from '@/components/ui/button';
import { Download, Copy, Check } from 'lucide-react';
import type { CanvasEvent } from '@/types/canvas';

interface SummaryExportProps {
  className?: string;
}

export function SummaryExport({ className }: SummaryExportProps) {
  const { eventLog, tasks } = useCanvasStore();
  const [copied, setCopied] = useState(false);

  // Extract decisions from event log
  const extractDecisions = useCallback((): string[] => {
    const decisions: string[] = [];
    eventLog.forEach(event => {
      if (event.details?.includes('decision') || event.details?.includes('Decision')) {
        decisions.push(`[${new Date(event.timestamp).toLocaleString()}] ${event.userName}: ${event.details}`);
      }
    });
    return decisions;
  }, [eventLog]);

  // Extract action items from tasks
  const extractActionItems = useCallback((): string[] => {
    return tasks.map(task => {
      const status = task.status === 'completed' ? '[DONE]' : task.status === 'in-progress' ? '[IN PROGRESS]' : '[TODO]';
      return `${status} ${task.title}${task.assignee ? ` (Assigned to: ${task.assignee})` : ''}${task.description ? `\n   Description: ${task.description}` : ''}`;
    });
  }, [tasks]);

  // Extract open questions
  const extractOpenQuestions = useCallback((): string[] => {
    const questions: string[] = [];
    eventLog.forEach(event => {
      if (event.details?.includes('?') || event.details?.toLowerCase().includes('question')) {
        questions.push(`[${new Date(event.timestamp).toLocaleString()}] ${event.userName}: ${event.details}`);
      }
    });
    return questions;
  }, [eventLog]);

  // Extract references mentioned in content
  const extractReferences = useCallback((): string[] => {
    const references: Set<string> = new Set();
    eventLog.forEach(event => {
      // Look for URLs or reference-like patterns
      const urlPattern = /https?:\/\/[^\s]+/g;
      const matches = event.details?.match(urlPattern) || [];
      matches.forEach(url => references.add(url));
    });
    return Array.from(references);
  }, [eventLog]);

  // Generate markdown summary
  const generateMarkdown = useCallback((): string => {
    const decisions = extractDecisions();
    const actionItems = extractActionItems();
    const openQuestions = extractOpenQuestions();
    const references = extractReferences();

    const timestamp = new Date().toLocaleString();

    let markdown = `# LIGMA Canvas Summary\n\n`;
    markdown += `*Generated on ${timestamp}*\n\n`;
    markdown += `---\n\n`;

    // Decisions Section
    if (decisions.length > 0) {
      markdown += `## Decisions Made\n\n`;
      decisions.forEach(decision => {
        markdown += `- ${decision}\n`;
      });
      markdown += `\n`;
    } else {
      markdown += `## Decisions Made\n\n`;
      markdown += `*No decisions recorded yet*\n\n`;
    }

    // Action Items Section
    markdown += `## Tasks & Action Items\n\n`;
    if (actionItems.length > 0) {
      actionItems.forEach(item => {
        markdown += `${item}\n\n`;
      });
    } else {
      markdown += `*No tasks created yet*\n\n`;
    }

    // Open Questions Section
    if (openQuestions.length > 0) {
      markdown += `## Open Questions\n\n`;
      openQuestions.forEach(question => {
        markdown += `- ${question}\n`;
      });
      markdown += `\n`;
    }

    // References Section
    if (references.length > 0) {
      markdown += `## References Mentioned\n\n`;
      references.forEach(ref => {
        markdown += `- ${ref}\n`;
      });
      markdown += `\n`;
    }

    // Stats Section
    markdown += `---\n\n`;
    markdown += `## Session Statistics\n\n`;
    markdown += `- Total Events: ${eventLog.length}\n`;
    markdown += `- Total Tasks: ${tasks.length}\n`;
    markdown += `- Completed Tasks: ${tasks.filter(t => t.status === 'completed').length}\n`;
    markdown += `- Pending Tasks: ${tasks.filter(t => t.status === 'pending').length}\n`;
    markdown += `- In Progress Tasks: ${tasks.filter(t => t.status === 'in-progress').length}\n`;

    return markdown;
  }, [eventLog, tasks, extractDecisions, extractActionItems, extractOpenQuestions, extractReferences]);

  // Generate JSON summary
  const generateJSON = useCallback((): string => {
    const summary = {
      generatedAt: new Date().toISOString(),
      decisions: extractDecisions(),
      actionItems: tasks.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        assignee: t.assignee,
      })),
      openQuestions: extractOpenQuestions(),
      references: extractReferences(),
      stats: {
        totalEvents: eventLog.length,
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
        pendingTasks: tasks.filter(t => t.status === 'pending').length,
        inProgressTasks: tasks.filter(t => t.status === 'in-progress').length,
      },
    };
    return JSON.stringify(summary, null, 2);
  }, [eventLog, tasks, extractDecisions, extractActionItems, extractOpenQuestions, extractReferences]);

  const handleDownloadMarkdown = useCallback(() => {
    const markdown = generateMarkdown();
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ligma-canvas-summary-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [generateMarkdown]);

  const handleDownloadJSON = useCallback(() => {
    const json = generateJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ligma-canvas-summary-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [generateJSON]);

  const handleCopyToClipboard = useCallback(async () => {
    const markdown = generateMarkdown();
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generateMarkdown]);

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadMarkdown}
          className="gap-2"
          title="Download as Markdown"
        >
          <Download className="size-4" />
          Export .md
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadJSON}
          className="gap-2"
          title="Download as JSON"
        >
          <Download className="size-4" />
          Export .json
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyToClipboard}
          className="gap-2"
          title="Copy to Clipboard"
        >
          {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}