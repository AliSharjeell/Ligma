'use client';

import React, { useState, useRef, useEffect } from 'react';
import rough from 'roughjs';
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
  const svgRef = useRef<SVGSVGElement>(null);

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

  // Rough selection border
  useEffect(() => {
    if (!svgRef.current) return;
    const rc = rough.svg(svgRef.current);
    while (svgRef.current.firstChild) {
      svgRef.current.removeChild(svgRef.current.firstChild);
    }

    if (isSelected && !isEditing) {
      const { width, height } = element.size;
      const node = rc.rectangle(-4, -4, width + 8, height + 8, {
        stroke: '#3b82f6',
        strokeWidth: 1.5,
        roughness: 1,
        bowing: 1,
      });
      svgRef.current.appendChild(node);
    }
  }, [isSelected, isEditing, element.size]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) return;
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
      <svg
        ref={svgRef}
        className="absolute inset-0 pointer-events-none overflow-visible"
        style={{ width: '100%', height: '100%' }}
      />

      {isEditing || isBeingEdited ? (
        <input
          ref={inputRef}
          type="text"
          value={localContent}
          onChange={(e) => setLocalContent(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="px-2 py-1 bg-transparent border-none outline-none w-full relative z-10"
          style={{
            fontSize: element.textStyle?.fontSize || 20,
            fontFamily: element.textStyle?.fontFamily || 'var(--font-handwritten), cursive',
            fontWeight: element.textStyle?.fontWeight || 'normal',
            textAlign: element.textStyle?.textAlign || 'left',
            color: element.color || '#1f2937',
            caretColor: element.color || '#1f2937',
          }}
          placeholder="Type here..."
        />
      ) : (
        <div
          className="px-2 py-1 whitespace-nowrap min-h-[1.5em] relative z-10"
          style={{
            color: element.color || '#1f2937',
            fontSize: element.textStyle?.fontSize || 20,
            fontFamily: element.textStyle?.fontFamily || 'var(--font-handwritten), cursive',
            fontWeight: element.textStyle?.fontWeight || 'normal',
            textAlign: element.textStyle?.textAlign || 'left',
          }}
        >
          {element.content || 'Double-click to edit'}
        </div>
      )}
    </div>
  );
}
