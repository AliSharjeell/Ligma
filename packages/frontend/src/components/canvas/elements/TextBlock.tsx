'use client';

import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { useSocket } from '@/contexts/socket-context';
import { cn } from '@/lib/utils';
import type { CanvasElement } from '@/types/canvas';

interface TextBlockProps {
  element: CanvasElement;
  skipSelectionBorder?: boolean;
}

type HandlePosition = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

export function TextBlock({ element, skipSelectionBorder = false }: TextBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [localContent, setLocalContent] = useState(element.content);
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  const {
    selectedIds, setSelectedId, updateElement, lockElement, unlockElement,
    userId, userRole, clearSelection,
    textFontSize,
    viewportZoom,
  } = useCanvasStore();
  const { emitElementUpdate, emitElementLock, emitElementUnlock } = useSocket();

  const isSelected = selectedIds.has(element.id);
  const isLocked = element.locked && element.lockedBy !== userId;
  const isBeingEdited = element.locked && element.lockedBy === userId;

  const currentFontSize = element.textStyle?.fontSize || textFontSize || 20;
  const fontFamily = element.textStyle?.fontFamily || 'var(--font-handwritten), cursive';
  const fontWeight = element.textStyle?.fontWeight || 'normal';
  const fontColor = element.color || '#1f2937';

  const showSelection = (isSelected || isHovered) && element.content && !isEditing && !isBeingEdited;

  // Measure actual text dimensions
  const [textBounds, setTextBounds] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (textRef.current) {
      const rect = textRef.current.getBoundingClientRect();
      const parentRect = textRef.current.parentElement?.getBoundingClientRect();
      if (parentRect) {
        setTextBounds({
          width: rect.width,
          height: rect.height
        });
      }
    }
  }, [element.content, currentFontSize, fontFamily, fontWeight, fontColor]);

  useEffect(() => {
    if ((isEditing || isBeingEdited) && inputRef.current) {
      inputRef.current.focus();
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

  const startResize = useCallback((e: React.MouseEvent, position: HandlePosition) => {
    e.stopPropagation();
    e.preventDefault();

    // Prevent Viewers from resizing
    if (userRole === 'Viewer') {
      alert('You are in Viewer mode. Ask a Lead or Contributor to edit.');
      return;
    }

    const startY = e.clientY;
    const startFontSize = currentFontSize;

    setIsResizing(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dy = moveEvent.clientY - startY;
      let newSize = startFontSize;

      switch (position) {
        case 'nw':
        case 'n':
        case 'ne':
          newSize = Math.max(10, startFontSize - dy);
          break;
        case 'sw':
        case 's':
        case 'se':
          newSize = Math.max(10, startFontSize + dy);
          break;
        case 'w':
        case 'e':
          newSize = Math.max(10, startFontSize + dy * 0.3);
          break;
      }

      const newTextStyle = { ...element.textStyle, fontSize: newSize };
      updateElement(element.id, { textStyle: newTextStyle });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setIsResizing(false);
      const updatedElement = useCanvasStore.getState().getElement(element.id);
      if (updatedElement) {
        emitElementUpdate(updatedElement);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [currentFontSize, element.textStyle, element.id, updateElement, emitElementUpdate, userRole]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked || isResizing) return;
    if (isEditing) return;
    setSelectedId(element.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...element.position };

    setIsDragging(true);

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
      setIsDragging(false);
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
    if (!element.content && !localContent) {
      // Delete empty text
      useCanvasStore.getState().deleteElement(element.id);
      return;
    }
    clearSelection();
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
      e.preventDefault();
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

  // Excalidraw-style selection border
  const SelectionBorder = () => {
    if (!showSelection || skipSelectionBorder) return null;

    const padding = 4;
    const handleSize = 8;

    return (
      <>
        {/* Selection outline - a simple box */}
        <div
          className="pointer-events-none absolute border-2 border-blue-500 rounded-sm"
          style={{
            left: -padding,
            top: -padding,
            width: textBounds.width + padding * 2,
            height: textBounds.height + padding * 2,
            zIndex: 0,
          }}
        />

        {/* Corner handles */}
        <div
          className="absolute bg-white border-2 border-blue-500 rounded-sm cursor-nwse-resize z-50"
          style={{
            left: -padding - handleSize / 2,
            top: -padding - handleSize / 2,
            width: handleSize,
            height: handleSize,
          }}
          onMouseDown={(e) => startResize(e, 'nw')}
        />
        <div
          className="absolute bg-white border-2 border-blue-500 rounded-sm cursor-nesw-resize z-50"
          style={{
            right: -padding - handleSize / 2,
            top: -padding - handleSize / 2,
            width: handleSize,
            height: handleSize,
          }}
          onMouseDown={(e) => startResize(e, 'ne')}
        />
        <div
          className="absolute bg-white border-2 border-blue-500 rounded-sm cursor-nesw-resize z-50"
          style={{
            left: -padding - handleSize / 2,
            bottom: -padding - handleSize / 2,
            width: handleSize,
            height: handleSize,
          }}
          onMouseDown={(e) => startResize(e, 'sw')}
        />
        <div
          className="absolute bg-white border-2 border-blue-500 rounded-sm cursor-nwse-resize z-50"
          style={{
            right: -padding - handleSize / 2,
            bottom: -padding - handleSize / 2,
            width: handleSize,
            height: handleSize,
          }}
          onMouseDown={(e) => startResize(e, 'se')}
        />

        {/* Edge handles */}
        <div
          className="absolute bg-white border-2 border-blue-500 rounded-sm cursor-ns-resize z-50"
          style={{
            left: textBounds.width / 2 - handleSize / 2,
            top: -padding - handleSize / 2,
            width: handleSize,
            height: handleSize,
          }}
          onMouseDown={(e) => startResize(e, 'n')}
        />
        <div
          className="absolute bg-white border-2 border-blue-500 rounded-sm cursor-ns-resize z-50"
          style={{
            left: textBounds.width / 2 - handleSize / 2,
            bottom: -padding - handleSize / 2,
            width: handleSize,
            height: handleSize,
          }}
          onMouseDown={(e) => startResize(e, 's')}
        />
        <div
          className="absolute bg-white border-2 border-blue-500 rounded-sm cursor-ew-resize z-50"
          style={{
            left: -padding - handleSize / 2,
            top: textBounds.height / 2 - handleSize / 2,
            width: handleSize,
            height: handleSize,
          }}
          onMouseDown={(e) => startResize(e, 'w')}
        />
        <div
          className="absolute bg-white border-2 border-blue-500 rounded-sm cursor-ew-resize z-50"
          style={{
            right: -padding - handleSize / 2,
            top: textBounds.height / 2 - handleSize / 2,
            width: handleSize,
            height: handleSize,
          }}
          onMouseDown={(e) => startResize(e, 'e')}
        />
      </>
    );
  };

  return (
    <div
      className={cn(
        'absolute select-none cursor-text outline-none',
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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <SelectionBorder />

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
            fontSize: currentFontSize,
            fontFamily,
            fontWeight,
            color: fontColor,
            caretColor: fontColor,
            width: `${Math.max(1, localContent.length)}ch`,
          }}
        />
      ) : (
        <span
          ref={textRef}
          className="px-0 py-0 whitespace-nowrap relative z-10"
          style={{
            color: fontColor,
            fontSize: currentFontSize,
            fontFamily,
            fontWeight,
          }}
        >
          {element.content}
        </span>
      )}
    </div>
  );
}