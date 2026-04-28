'use client';

import React, { useState } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { useSocket } from '@/contexts/socket-context';
import { cn } from '@/lib/utils';
import type { CanvasElement } from '@/types/canvas';

interface ShapeProps {
  element: CanvasElement;
}

const STROKE_COLORS = [
  '#374151', // gray-700
  '#ef4444', // red
  '#06b6d4', // cyan
  '#22c55e', // green
  '#8b5cf6', // purple
  '#f97316', // orange
];

export function Shape({ element }: ShapeProps) {
  const { selectedIds, setSelectedId, setSelectedIds, updateElement, lockElement, unlockElement, userId } = useCanvasStore();
  const { emitElementUpdate, emitElementLock, emitElementUnlock } = useSocket();

  const isSelected = selectedIds.has(element.id);
  const isLocked = element.locked && element.lockedBy !== userId;
  const isEditing = element.locked && element.lockedBy === userId;
  const strokeColor = element.color || STROKE_COLORS[0];

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const lockedByMe = Array.from(useCanvasStore.getState().elements.values()).find(
      (item) => item.locked && item.lockedBy === userId && item.id !== element.id
    );
    if (lockedByMe) return;
    if (isLocked) return;
    setSelectedId(element.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...element.position };
    const startSize = { ...element.size };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const state = useCanvasStore.getState();
      const dx = (moveEvent.clientX - startX) / state.viewportZoom;
      const dy = (moveEvent.clientY - startY) / state.viewportZoom;

      if (moveEvent.shiftKey) {
        updateElement(element.id, {
          size: {
            width: Math.max(20, startSize.width + dx),
            height: Math.max(20, startSize.height + dy),
          },
        });
      } else {
        updateElement(element.id, {
          position: { x: startPos.x + dx, y: startPos.y + dy },
        });
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      const updatedElement = useCanvasStore.getState().getElement(element.id);
      if (updatedElement) {
        emitElementUpdate(updatedElement);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    lockElement(element.id);
    emitElementLock(element.id);
  };

  const handleBlur = () => {
    if (element.locked && element.lockedBy === userId) {
      unlockElement(element.id);
      emitElementUnlock(element.id);
    }
  };

  const handleColorChange = (color: string) => {
    updateElement(element.id, { color });
    const updatedElement = useCanvasStore.getState().getElement(element.id);
    if (updatedElement) {
      emitElementUpdate(updatedElement);
    }
  };

  const renderShape = () => {
    const strokeWidth = isSelected ? 3 : 2;

    if (element.shapeType === 'circle') {
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <ellipse
            cx="50"
            cy="50"
            rx="48"
            ry="48"
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        </svg>
      );
    }

    return (
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <rect
          x="2"
          y="2"
          width="96"
          height="96"
          rx="8"
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      </svg>
    );
  };

  return (
    <div
      className={cn(
        'absolute select-none cursor-move',
        isSelected && 'ring-2 ring-blue-500 ring-offset-1',
        isLocked && 'opacity-50 pointer-events-none',
        isEditing && 'ring-2 ring-yellow-400'
      )}
      style={{
        left: element.position.x,
        top: element.position.y,
        width: element.size.width,
        height: element.size.height,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      tabIndex={0}
      onBlur={handleBlur}
    >
      {renderShape()}

      {isSelected && !isLocked && (
        <div className="absolute -bottom-8 left-0 flex gap-1 bg-white rounded-lg shadow-lg p-1">
          {STROKE_COLORS.map((color) => (
            <button
              key={color}
              onClick={(e) => {
                e.stopPropagation();
                handleColorChange(color);
              }}
              className={cn(
                'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
                element.color === color ? 'border-gray-800' : 'border-transparent'
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      )}

      <div
        className="absolute -top-2 -right-2 w-4 h-4 bg-primary rounded-full cursor-se-resize"
        onMouseDown={(e) => {
          e.stopPropagation();
          if (isLocked) return;

          const startX = e.clientX;
          const startY = e.clientY;
          const startSize = { ...element.size };

          const handleResize = (moveEvent: MouseEvent) => {
            const state = useCanvasStore.getState();
            const dx = (moveEvent.clientX - startX) / state.viewportZoom;
            const dy = (moveEvent.clientY - startY) / state.viewportZoom;
            updateElement(element.id, {
              size: {
                width: Math.max(20, startSize.width + dx),
                height: Math.max(20, startSize.height + dy),
              },
            });
          };

          const handleUp = () => {
            document.removeEventListener('mousemove', handleResize);
            document.removeEventListener('mouseup', handleUp);
            const updatedElement = useCanvasStore.getState().getElement(element.id);
            if (updatedElement) {
              emitElementUpdate(updatedElement);
            }
          };

          document.addEventListener('mousemove', handleResize);
          document.addEventListener('mouseup', handleUp);
        }}
      />
    </div>
  );
}