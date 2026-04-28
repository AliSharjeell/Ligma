'use client';

import React from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Activity, ChevronLeft } from 'lucide-react';
import type { CanvasEvent } from '@/types/canvas';

const eventTypeColors = {
  create: 'text-green-600 bg-green-50',
  update: 'text-blue-600 bg-blue-50',
  delete: 'text-red-600 bg-red-50',
  lock: 'text-yellow-600 bg-yellow-50',
  unlock: 'text-purple-600 bg-purple-50',
  cursor: 'text-gray-600 bg-gray-50',
};

const eventTypeLabels = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  lock: 'Locked',
  unlock: 'Unlocked',
  cursor: 'Moved cursor',
};

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function EventItem({ event }: { event: CanvasEvent }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b last:border-0">
      <div className={cn('px-2 py-1 rounded text-xs font-medium', eventTypeColors[event.type])}>
        {eventTypeLabels[event.type]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{event.userName}</span>
          <span className="text-xs text-muted-foreground" title={formatTime(event.timestamp)}>
            {formatRelativeTime(event.timestamp)}
          </span>
        </div>
        {event.details && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.details}</p>
        )}
      </div>
    </div>
  );
}

interface ActivityPanelProps {
  onBack: () => void;
}

export function ActivityPanel({ onBack }: ActivityPanelProps) {
  const { eventLog } = useCanvasStore();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ChevronLeft className="size-4" />
        </Button>
        <h3 className="text-sm font-semibold">Activity</h3>
        {eventLog.length > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            {eventLog.length}
          </span>
        )}
      </div>

      <ScrollArea className="flex-1">
        {eventLog.length > 0 ? (
          <div className="space-y-1">
            {eventLog.map((event) => (
              <EventItem key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="size-8 mx-auto mb-2 opacity-50" />
            <p>No events yet</p>
            <p className="text-sm">Activity will appear here as you work</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// Re-export as EventLog for backwards compatibility (no onBack needed, standalone sheet)
export function EventLog() {
  return <ActivityPanel onBack={() => {}} />;
}
