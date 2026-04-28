'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { useSocket } from '@/contexts/socket-context';
import { cn } from '@/lib/utils';
import type { CanvasElement, Position } from '@/types/canvas';

interface StickyNoteProps {
  element: CanvasElement;
}

const COLORS = [
  '#fef08a', // yellow
  '#fca5a5', // red
  '#a5f3fc', // cyan
  '#bbf7d0', // green
  '#ddd6fe', // purple
  '#fed7aa', // orange
];

export function StickyNote({ element }: StickyNoteProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localContent, setLocalContent] = useState(element.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { selectedIds, setSelectedId, setSelectedIds, updateElement, lockElement, unlockElement, userId, userRole } = useCanvasStore();
  const { emitElementUpdate, emitElementLock, emitElementUnlock } = useSocket();

  const isSelected = selectedIds.has(element.id);
  const isLocked = element.locked && element.lockedBy !== userId;

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) {
      setLocalContent(element.content);
    }
  }, [element.content, isEditing]);

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

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / (useCanvasStore.getState().viewportZoom);
      const dy = (moveEvent.clientY - startY) / (useCanvasStore.getState().viewportZoom);
      updateElement(element.id, {
        position: { x: startPos.x + dx, y: startPos.y + dy },
      });
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
    if (userRole === 'Viewer') {
      alert('You are in Viewer mode. Ask a Lead or Contributor to edit.');
      return;
    }
    setSelectedId(element.id);
    setIsEditing(true);
    lockElement(element.id);
    emitElementLock(element.id);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (localContent !== element.content) {
      updateElement(element.id, { content: localContent });
      const updatedElement = useCanvasStore.getState().getElement(element.id);
      if (updatedElement) {
        emitElementUpdate(updatedElement);
      }
    }
    if (element.locked) {
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

  return (
    <div
      className={cn(
        'absolute select-none transition-shadow',
        isSelected && 'ring-2 ring-primary',
        isLocked && 'opacity-50 pointer-events-none'
      )}
      style={{
        left: element.position.x,
        top: element.position.y,
        width: element.size.width,
        height: element.size.height,
        backgroundColor: element.color || COLORS[0],
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={localContent}
          onChange={(e) => setLocalContent(e.target.value)}
          onBlur={handleBlur}
          className="w-full h-full p-3 bg-transparent resize-none outline-none text-gray-800"
          placeholder="Type here..."
        />
      ) : (
        <div className="w-full h-full p-3 text-gray-800 overflow-hidden">
          {element.content || 'Double-click to edit'}
        </div>
      )}

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

      {element.locked && element.lockedBy === userId && (
        <div className="absolute -top-6 right-0 text-xs bg-primary text-white px-2 py-1 rounded">
          Editing
        </div>
      )}
    </div>
  );
}