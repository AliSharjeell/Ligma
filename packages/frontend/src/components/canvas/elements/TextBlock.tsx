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

  const { selectedIds, setSelectedId, updateElement, lockElement, unlockElement, userId } = useCanvasStore();
  const { emitElementUpdate, emitElementLock, emitElementUnlock } = useSocket();

  const isSelected = selectedIds.has(element.id);
  const isLocked = element.locked && element.lockedBy !== userId;
  const isBeingEdited = element.locked && element.lockedBy === userId;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) {
      setLocalContent(element.content);
    }
  }, [element.content, isEditing]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    setSelectedId(element.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...element.position };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const zoom = useCanvasStore.getState().viewportZoom;
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;
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
        'absolute select-none cursor-move group',
        isSelected && 'ring-2 ring-primary',
        isLocked && 'opacity-50 pointer-events-none'
      )}
      style={{
        left: element.position.x,
        top: element.position.y,
        minWidth: element.size.width || 100,
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
          className="px-2 py-1 bg-transparent border-none outline-none w-full"
          style={{
            fontSize: element.textStyle?.fontSize || 18,
            fontFamily: element.textStyle?.fontFamily || 'Georgia, serif',
            fontWeight: element.textStyle?.fontWeight || 'normal',
            textAlign: element.textStyle?.textAlign || 'left',
            color: element.color || '#1f2937',
            caretColor: element.color || '#1f2937',
          }}
          placeholder="Type here..."
        />
      ) : (
        <div
          className="px-2 py-1 whitespace-nowrap min-h-[1.5em]"
          style={{
            color: element.color || '#1f2937',
            fontSize: element.textStyle?.fontSize || 18,
            fontFamily: element.textStyle?.fontFamily || 'Georgia, serif',
            fontWeight: element.textStyle?.fontWeight || 'normal',
            textAlign: element.textStyle?.textAlign || 'left',
          }}
        >
          {element.content || 'Double-click to edit'}
        </div>
      )}

      {isSelected && !isLocked && !isEditing && (
        <div className="absolute -bottom-6 left-0 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          Double-click to edit
        </div>
      )}
    </div>
  );
}
