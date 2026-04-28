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
  const inputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  const {
    selectedIds, setSelectedId, updateElement, lockElement, unlockElement,
    userId, userRole, clearSelection,
    textFontSize,
    viewportZoom,
    tool,
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
  const [textBounds, setTextBounds] = useState({ width: element.size.width || 100, height: element.size.height || currentFontSize * 1.4 });

  useLayoutEffect(() => {
    if (textRef.current && element.content) {
      const rect = textRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
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

    if (userRole === 'Viewer') {
      alert('You are in Viewer mode. Ask a Lead or Contributor to edit.');
      return;
    }

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...element.position };
    const startSize = { ...element.size };
    const startFontSize = currentFontSize;

    setIsResizing(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const state = useCanvasStore.getState();
      const dx = (moveEvent.clientX - startX) / state.viewportZoom;
      const dy = (moveEvent.clientY - startY) / state.viewportZoom;

      let newWidth = startSize.width;
      let newHeight = startSize.height;
      let newX = startPos.x;
      let newY = startPos.y;
      let newFontSize = startFontSize;

      switch (position) {
        case 'nw':
          newWidth = Math.max(50, startSize.width - dx);
          newHeight = Math.max(20, startSize.height - dy);
          newX = startPos.x + startSize.width - newWidth;
          newY = startPos.y + startSize.height - newHeight;
          newFontSize = Math.max(10, Math.min(120, startFontSize - dy));
          break;
        case 'ne':
          newWidth = Math.max(50, startSize.width + dx);
          newHeight = Math.max(20, startSize.height - dy);
          newY = startPos.y + startSize.height - newHeight;
          newFontSize = Math.max(10, Math.min(120, startFontSize - dy));
          break;
        case 'sw':
          newWidth = Math.max(50, startSize.width - dx);
          newHeight = Math.max(20, startSize.height + dy);
          newX = startPos.x + startSize.width - newWidth;
          newFontSize = Math.max(10, Math.min(120, startFontSize + dy));
          break;
        case 'se':
          newWidth = Math.max(50, startSize.width + dx);
          newHeight = Math.max(20, startSize.height + dy);
          newFontSize = Math.max(10, Math.min(120, startFontSize + dy));
          break;
        case 'n':
          newHeight = Math.max(20, startSize.height - dy);
          newY = startPos.y + startSize.height - newHeight;
          newFontSize = Math.max(10, Math.min(120, startFontSize - dy));
          break;
        case 's':
          newHeight = Math.max(20, startSize.height + dy);
          newFontSize = Math.max(10, Math.min(120, startFontSize + dy));
          break;
        case 'e':
          newWidth = Math.max(50, startSize.width + dx);
          newFontSize = Math.max(10, Math.min(120, startFontSize + dx * 0.3));
          break;
        case 'w':
          newWidth = Math.max(50, startSize.width - dx);
          newX = startPos.x + startSize.width - newWidth;
          newFontSize = Math.max(10, Math.min(120, startFontSize - dx * 0.3));
          break;
      }

      updateElement(element.id, {
        position: { x: newX, y: newY },
        size: { width: newWidth, height: newHeight },
        textStyle: { ...element.textStyle, fontSize: newFontSize },
      });
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
  }, [currentFontSize, element.textStyle, element.id, element.position, element.size, updateElement, emitElementUpdate, userRole]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked || isResizing) return;
    if (isEditing) return;
    if (tool === 'select') {
      setSelectedId(element.id);
    }
    // For other tools, let the event propagate to canvas

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
    if (!element.content && !localContent) {
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

  const handleSize = 8;

  return (
    <div
      className={cn(
        'absolute select-none outline-none',
        isLocked && 'opacity-50 pointer-events-none',
        tool === 'draw' ? 'cursor-crosshair' : 'cursor-text'
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
      {/* Selection outline with 8 handles */}
      {showSelection && !skipSelectionBorder && (
        <>
          {/* Selection border */}
          <div
            className="absolute border-2 border-blue-500 rounded-sm pointer-events-none"
            style={{
              left: -4,
              top: -4,
              width: textBounds.width + 8,
              height: textBounds.height + 8,
              zIndex: 1,
            }}
          />

          {/* Corner handles */}
          <div
            className="absolute bg-white border-2 border-blue-500 rounded-sm z-50"
            style={{
              left: -4 - handleSize / 2,
              top: -4 - handleSize / 2,
              width: handleSize,
              height: handleSize,
              cursor: 'nwse-resize',
            }}
            onMouseDown={(e) => startResize(e, 'nw')}
          />
          <div
            className="absolute bg-white border-2 border-blue-500 rounded-sm z-50"
            style={{
              right: -4 - handleSize / 2,
              top: -4 - handleSize / 2,
              width: handleSize,
              height: handleSize,
              cursor: 'nesw-resize',
            }}
            onMouseDown={(e) => startResize(e, 'ne')}
          />
          <div
            className="absolute bg-white border-2 border-blue-500 rounded-sm z-50"
            style={{
              left: -4 - handleSize / 2,
              bottom: -4 - handleSize / 2,
              width: handleSize,
              height: handleSize,
              cursor: 'nesw-resize',
            }}
            onMouseDown={(e) => startResize(e, 'sw')}
          />
          <div
            className="absolute bg-white border-2 border-blue-500 rounded-sm z-50"
            style={{
              right: -4 - handleSize / 2,
              bottom: -4 - handleSize / 2,
              width: handleSize,
              height: handleSize,
              cursor: 'nwse-resize',
            }}
            onMouseDown={(e) => startResize(e, 'se')}
          />

          {/* Edge handles */}
          <div
            className="absolute bg-white border-2 border-blue-500 rounded-sm z-50"
            style={{
              left: textBounds.width / 2 - handleSize / 2,
              top: -4 - handleSize / 2,
              width: handleSize,
              height: handleSize,
              cursor: 'ns-resize',
            }}
            onMouseDown={(e) => startResize(e, 'n')}
          />
          <div
            className="absolute bg-white border-2 border-blue-500 rounded-sm z-50"
            style={{
              left: textBounds.width / 2 - handleSize / 2,
              bottom: -4 - handleSize / 2,
              width: handleSize,
              height: handleSize,
              cursor: 'ns-resize',
            }}
            onMouseDown={(e) => startResize(e, 's')}
          />
          <div
            className="absolute bg-white border-2 border-blue-500 rounded-sm z-50"
            style={{
              left: -4 - handleSize / 2,
              top: textBounds.height / 2 - handleSize / 2,
              width: handleSize,
              height: handleSize,
              cursor: 'ew-resize',
            }}
            onMouseDown={(e) => startResize(e, 'w')}
          />
          <div
            className="absolute bg-white border-2 border-blue-500 rounded-sm z-50"
            style={{
              right: -4 - handleSize / 2,
              top: textBounds.height / 2 - handleSize / 2,
              width: handleSize,
              height: handleSize,
              cursor: 'ew-resize',
            }}
            onMouseDown={(e) => startResize(e, 'e')}
          />
        </>
      )}

      {isEditing || isBeingEdited ? (
        <input
          ref={inputRef}
          type="text"
          value={localContent}
          onChange={(e) => setLocalContent(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="px-1 py-0 bg-white bg-opacity-80 border-2 border-blue-400 rounded outline-none relative z-10 w-auto min-w-[1ch]"
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