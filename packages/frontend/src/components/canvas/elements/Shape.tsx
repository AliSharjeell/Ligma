'use client';

import React, { useState } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { useSocket } from '@/contexts/socket-context';
import { cn } from '@/lib/utils';
import type { CanvasElement } from '@/types/canvas';

interface ShapeProps {
  element: CanvasElement;
}

const COLORS = [
  '#e2e8f0', // gray
  '#fca5a5', // red
  '#a5f3fc', // cyan
  '#bbf7d0', // green
  '#ddd6fe', // purple
  '#fed7aa', // orange
];

export function Shape({ element }: ShapeProps) {
  const { selectedId, setSelectedId, updateElement, lockElement, unlockElement, userId } = useCanvasStore();
  const { emitElementUpdate, emitElementLock, emitElementUnlock } = useSocket();

  const isSelected = selectedId === element.id;
  const isLocked = element.locked && element.lockedBy !== userId;
  const isEditing = element.locked && element.lockedBy === userId;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
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
    const style = {
      width: '100%',
      height: '100%',
      backgroundColor: element.color || COLORS[0],
    };

    if (element.shapeType === 'circle') {
      return <div className="w-full h-full rounded-full" style={style} />;
    }

    return <div className="w-full h-full rounded-md" style={style} />;
  };

  return (
    <div
      className={cn(
        'absolute select-none cursor-move',
        isSelected && 'ring-2 ring-primary ring-offset-2',
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
        <div className="absolute -bottom-8 left-0 flex gap-1">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={(e) => {
                e.stopPropagation();
                handleColorChange(color);
              }}
              className={cn(
                'w-5 h-5 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-110',
                element.color === color && 'ring-2 ring-gray-400'
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