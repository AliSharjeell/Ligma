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

  const { selectedIds, setSelectedId, updateElement, lockElement, unlockElement, userId, userRole } = useCanvasStore();
  const { emitElementUpdate, emitElementLock, emitElementUnlock } = useSocket();

  const isSelected = selectedIds.has(element.id);
  const isLocked = element.locked && element.lockedBy !== userId;
  const isBeingEdited = element.locked && element.lockedBy === userId;

  useEffect(() => {
    if ((isEditing || isBeingEdited) && inputRef.current) {
      inputRef.current.focus();
      // Only select if there is content
      if (localContent) {
        inputRef.current.select();
      }
    }
  }, [isEditing, isBeingEdited]);

  useEffect(() => {
    if (!isEditing) {
      setLocalContent(element.content);
    }
  }, [element.content, isEditing]);

  // Rough selection border - only shown when selected and NOT editing
  useEffect(() => {
    if (!svgRef.current) return;
    const rc = rough.svg(svgRef.current);
    while (svgRef.current.firstChild) {
      svgRef.current.removeChild(svgRef.current.firstChild);
    }

    if (isSelected && !isEditing && !isBeingEdited) {
      const { width, height } = element.size;
      const node = rc.rectangle(-4, -4, width + 8, height + 8, {
        stroke: '#3b82f6',
        strokeWidth: 1,
        roughness: 0.5,
      });
      svgRef.current.appendChild(node);
    }
  }, [isSelected, isEditing, isBeingEdited, element.size]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    if (isEditing) return; // Don't allow drag while editing
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
    // If empty content, we might want to delete it or keep it? Excalidraw keeps it until blurred
    updateElement(element.id, { content: localContent });
    const updatedElement = useCanvasStore.getState().getElement(element.id);
    if (updatedElement) {
      emitElementUpdate(updatedElement);
    }
    
    if (element.locked && element.lockedBy === userId) {
      unlockElement(element.id);
      emitElementUnlock(element.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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
        'absolute select-none cursor-text group outline-none',
        isLocked && 'opacity-50 pointer-events-none'
      )}
      style={{
        left: element.position.x,
        top: element.position.y,
        minWidth: '10px',
        zIndex: isEditing ? 100 : 1,
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
          className="px-0 py-0 bg-transparent border-none outline-none relative z-10 w-auto min-w-[1ch]"
          style={{
            fontSize: element.textStyle?.fontSize || 20,
            fontFamily: element.textStyle?.fontFamily || 'var(--font-handwritten), cursive',
            fontWeight: element.textStyle?.fontWeight || 'normal',
            textAlign: element.textStyle?.textAlign || 'left',
            color: element.color || '#1f2937',
            caretColor: element.color || '#1f2937',
            // Simple auto-resize trick for input
            width: `${Math.max(1, localContent.length)}ch`,
          }}
        />
      ) : (
        <div
          className="px-0 py-0 whitespace-nowrap min-h-[1.2em] relative z-10"
          style={{
            color: element.color || '#1f2937',
            fontSize: element.textStyle?.fontSize || 20,
            fontFamily: element.textStyle?.fontFamily || 'var(--font-handwritten), cursive',
            fontWeight: element.textStyle?.fontWeight || 'normal',
            textAlign: element.textStyle?.textAlign || 'left',
          }}
        >
          {element.content}
        </div>
      )}
    </div>
  );
}
