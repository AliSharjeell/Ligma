'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { useSocket } from '@/contexts/socket-context';
import { cn } from '@/lib/utils';
import type { CanvasElement } from '@/types/canvas';

interface TextBlockProps {
  element: CanvasElement;
}

export function TextBlock({ element }: TextBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localContent, setLocalContent] = useState(element.content);
  const inputRef = useRef<HTMLInputElement>(null);

  const { selectedId, setSelectedId, updateElement, lockElement, unlockElement, userId } = useCanvasStore();
  const { emitElementUpdate, emitElementLock, emitElementUnlock } = useSocket();

  const isSelected = selectedId === element.id;
  const isLocked = element.locked && element.lockedBy !== userId;
  const isBeingEdited = element.locked && element.lockedBy === userId;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked || isEditing) return;
    setSelectedId(element.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...element.position };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const state = useCanvasStore.getState();
      const dx = (moveEvent.clientX - startX) / state.viewportZoom;
      const dy = (moveEvent.clientY - startY) / state.viewportZoom;
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
    if (element.locked && element.lockedBy === userId) {
      unlockElement(element.id);
      emitElementUnlock(element.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
    if (e.key === 'Escape') {
      setLocalContent(element.content);
      setIsEditing(false);
      if (element.locked && element.lockedBy === userId) {
        unlockElement(element.id);
        emitElementUnlock(element.id);
      }
    }
  };

  return (
    <div
      className={cn(
        'absolute select-none cursor-move',
        isSelected && 'ring-2 ring-primary',
        isLocked && 'opacity-50 pointer-events-none'
      )}
      style={{
        left: element.position.x,
        top: element.position.y,
        minWidth: element.size.width,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {isEditing || isBeingEdited ? (
        <input
          ref={inputRef}
          type="text"
          value={localContent}
          onChange={(e) => setLocalContent(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="px-2 py-1 text-lg font-medium bg-transparent border-none outline-none w-full min-w-[100px]"
        />
      ) : (
        <div className="px-2 py-1 text-lg font-medium text-gray-800 whitespace-nowrap">
          {element.content || 'Double-click to edit'}
        </div>
      )}

      {isSelected && !isLocked && (
        <div className="absolute -bottom-6 left-0 text-xs text-muted-foreground">
          Double-click to edit, Shift+drag to resize
        </div>
      )}
    </div>
  );
}