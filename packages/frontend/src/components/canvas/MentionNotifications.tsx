'use client';

import React, { useEffect, useState } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { X, AtSign } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function MentionNotifications() {
  const { mentionNotifications, markMentionNotificationRead, unreadMentionCount } = useCanvasStore();
  const [visibleNotifications, setVisibleNotifications] = useState<typeof mentionNotifications>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Auto-dismiss notifications after 10 seconds
  useEffect(() => {
    if (visibleNotifications.length === 0) return;

    const timers = visibleNotifications.map(notification => {
      return setTimeout(() => {
        setDismissedIds(prev => new Set([...prev, notification.id]));
      }, 10000);
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [visibleNotifications]);

  // Show new notifications
  useEffect(() => {
    const unread = mentionNotifications.filter(n => !n.read && !dismissedIds.has(n.id));
    if (unread.length > 0) {
      // Add new notifications to visible list
      setVisibleNotifications(prev => {
        const existingIds = new Set(prev.map(n => n.id));
        const newOnes = unread.filter(n => !existingIds.has(n.id));
        return [...newOnes, ...prev].slice(0, 3);
      });
    }
  }, [mentionNotifications, dismissedIds]);

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
    markMentionNotificationRead(id);
  };

  const handleNotificationClick = (id: string, commentId: string) => {
    markMentionNotificationRead(id);
    // Could navigate to the comment here
    setDismissedIds(prev => new Set([...prev, id]));
  };

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {visibleNotifications.map((notification) => (
        <div
          key={notification.id}
          className={cn(
            'bg-white rounded-lg border border-gray-200 shadow-xl p-3 animate-in slide-in-from-right',
            !notification.read && 'border-l-4 border-l-blue-500'
          )}
        >
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-blue-100">
              <AtSign className="size-4 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0"
                  style={{ backgroundColor: notification.authorColor }}
                >
                  {notification.authorName[0].toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-900 truncate">
                  {notification.authorName} mentioned you
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                {notification.content}
              </p>
              <button
                onClick={() => handleNotificationClick(notification.id, notification.commentId)}
                className="text-xs text-blue-500 hover:text-blue-600 mt-1"
              >
                View comment
              </button>
            </div>
            <button
              onClick={() => handleDismiss(notification.id)}
              className="flex-shrink-0 p-1 hover:bg-gray-100 rounded"
            >
              <X className="size-4 text-gray-400" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
