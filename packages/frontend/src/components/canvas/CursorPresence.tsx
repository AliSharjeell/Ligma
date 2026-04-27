'use client';

import React from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { cn } from '@/lib/utils';

export function CursorPresence() {
  const { users, userId, viewportPosition, viewportZoom } = useCanvasStore();

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from(users.values()).map((user) => {
        if (!user.cursor) return null;
        if (user.id === userId) return null;

        return (
          <div
            key={user.id}
            className="absolute transition-all duration-75 ease-out"
            style={{
              left: (user.cursor.x - viewportPosition.x) / viewportZoom,
              top: (user.cursor.y - viewportPosition.y) / viewportZoom,
              transform: 'translate(-2px, -2px)',
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="drop-shadow-md"
            >
              <path
                d="M5.5 3.21V20.79C5.5 21.45 6.27 21.83 6.82 21.4L11.12 17.87C11.4 17.63 11.77 17.5 12.15 17.5H19.5C20.17 17.5 20.5 16.68 20 16.21L6.82 1.89C6.27 1.46 5.5 1.84 5.5 2.5V3.21Z"
                fill={user.color}
                stroke="white"
                strokeWidth="2"
              />
            </svg>
            <div
              className="absolute left-5 top-4 px-2 py-0.5 rounded text-xs text-white whitespace-nowrap shadow-md"
              style={{ backgroundColor: user.color }}
            >
              {user.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}