'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import rough from 'roughjs';
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
  const [contentBounds, setContentBounds] = useState({ width: 0, height: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

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
  const showHandles = (isSelected || isHovered) && element.content && !isEditing && !isBeingEdited;

  // Measure actual content bounds
  useEffect(() => {
    if (contentRef.current && element.content) {
      const measureText = () => {
        const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const fontFamily = element.textStyle?.fontFamily || 'var(--font-handwritten), cursive';
        const fontSize = element.textStyle?.fontSize || currentFontSize;
        const fontWeight = element.textStyle?.fontWeight || 'normal';
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        const metrics = ctx.measureText(element.content);
        const width = metrics.width;
        const height = fontSize * 1.4; // Approximate line height
        setContentBounds({ width: Math.max(width, 10), height });
      }
      };

      // Delay to ensure font is loaded
      setTimeout(measureText, 50);
    }
  }, [element.content, element.textStyle?.fontFamily, element.textStyle?.fontSize, currentFontSize]);

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

  // Draw selection border and handles using SVG
  useEffect(() => {
    if (!svgRef.current) return;
    const rc = rough.svg(svgRef.current);
    while (svgRef.current.firstChild) {
      svgRef.current.removeChild(svgRef.current.firstChild);
    }

    if (!showHandles || skipSelectionBorder) return;

    // Use content bounds if available, otherwise use element size
    const displayWidth = contentBounds.width > 0 ? contentBounds.width : element.size.width;
    const displayHeight = contentBounds.height > 0 ? contentBounds.height : element.size.height;

    // Add padding around content
    const padding = 8;
    const borderWidth = displayWidth + padding * 2;
    const borderHeight = displayHeight + padding * 2;

    // Main selection border - use rough.js
    const border = rc.rectangle(-padding, -padding, borderWidth, borderHeight, {
      stroke: '#3b82f6',
      strokeWidth: 1,
      roughness: 0,
    });
    svgRef.current.appendChild(border);

    // Draw 8 handles at corners and edges
    const handleSize = 8;
    const handleOffset = handleSize / 2;

    const handles = [
      { x: -padding - handleOffset, y: -padding - handleOffset, pos: 'nw' as HandlePosition },
      { x: borderWidth / 2 - handleOffset, y: -padding - handleOffset, pos: 'n' as HandlePosition },
      { x: borderWidth - padding - handleOffset, y: -padding - handleOffset, pos: 'ne' as HandlePosition },
      { x: borderWidth - padding - handleOffset, y: borderHeight / 2 - handleOffset, pos: 'e' as HandlePosition },
      { x: borderWidth - padding - handleOffset, y: borderHeight - padding - handleOffset, pos: 'se' as HandlePosition },
      { x: borderWidth / 2 - handleOffset, y: borderHeight - padding - handleOffset, pos: 's' as HandlePosition },
      { x: -padding - handleOffset, y: borderHeight - padding - handleOffset, pos: 'sw' as HandlePosition },
      { x: -padding - handleOffset, y: borderHeight / 2 - handleOffset, pos: 'w' as HandlePosition },
    ];

    handles.forEach(h => {
      const handleRect = rc.rectangle(h.x, h.y, handleSize, handleSize, {
        fill: '#fff',
        stroke: '#3b82f6',
        strokeWidth: 1,
      });
      svgRef.current?.appendChild(handleRect);
    });
  }, [showHandles, skipSelectionBorder, element.size, contentBounds, element.content]);

  const startResize = useCallback((e: React.MouseEvent, position: HandlePosition) => {
    e.stopPropagation();
    e.preventDefault();
    const startY = e.clientY;
    const startX = e.clientX;
    const startFontSize = currentFontSize;
    const startWidth = element.size.width;

    setIsResizing(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      let newSize = startFontSize;

      // Resize based on handle position
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
          newSize = Math.max(10, startFontSize + dx * 0.5);
          break;
        case 'e':
          newSize = Math.max(10, startFontSize - dx * 0.5);
          break;
      }

      // Also update width based on content
      const widthChange = position.includes('e') ? dx : (position.includes('w') ? -dx : 0);
      const newWidth = Math.max(50, startWidth + widthChange);

      const newTextStyle = { ...element.textStyle, fontSize: newSize };
      updateElement(element.id, { textStyle: newTextStyle, size: { width: newWidth, height: newSize * 1.4 } });
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
  }, [currentFontSize, element.size, element.textStyle, element.id, updateElement, emitElementUpdate]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked || isResizing) return;
    if (isEditing) return;
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

  const getCursor = (pos: HandlePosition) => {
    switch (pos) {
      case 'nw':
      case 'se':
        return 'nwse-resize';
      case 'ne':
      case 'sw':
        return 'nesw-resize';
      case 'n':
      case 's':
        return 'ns-resize';
      case 'e':
      case 'w':
        return 'ew-resize';
    }
  };

  // Calculate padding offset for handles
  const padding = 8;
  const handleSize = 8;
  const borderWidth = contentBounds.width > 0 ? contentBounds.width + padding * 2 : element.size.width + padding * 2;
  const borderHeight = contentBounds.height > 0 ? contentBounds.height + padding * 2 : element.size.height + padding * 2;

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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <svg
        ref={svgRef}
        className="absolute pointer-events-none overflow-visible"
        style={{
          width: borderWidth,
          height: borderHeight,
          left: -padding,
          top: -padding,
        }}
      />

      {/* Invisible resize handle overlays */}
      {showHandles && (
        <>
          <div
            className="absolute cursor-nwse-resize z-50"
            style={{ left: -padding, top: -padding, width: handleSize, height: handleSize }}
            onMouseDown={(e) => startResize(e, 'nw')}
          />
          <div
            className="absolute cursor-nesw-resize z-50"
            style={{ right: -padding, top: -padding, width: handleSize, height: handleSize }}
            onMouseDown={(e) => startResize(e, 'ne')}
          />
          <div
            className="absolute cursor-nesw-resize z-50"
            style={{ left: -padding, bottom: -padding, width: handleSize, height: handleSize }}
            onMouseDown={(e) => startResize(e, 'sw')}
          />
          <div
            className="absolute cursor-nwse-resize z-50"
            style={{ right: -padding, bottom: -padding, width: handleSize, height: handleSize }}
            onMouseDown={(e) => startResize(e, 'se')}
          />
          <div
            className="absolute cursor-ns-resize z-50"
            style={{ left: borderWidth / 2 - handleSize / 2, top: -padding, width: handleSize, height: handleSize }}
            onMouseDown={(e) => startResize(e, 'n')}
          />
          <div
            className="absolute cursor-ns-resize z-50"
            style={{ left: borderWidth / 2 - handleSize / 2, bottom: -padding, width: handleSize, height: handleSize }}
            onMouseDown={(e) => startResize(e, 's')}
          />
          <div
            className="absolute cursor-ew-resize z-50"
            style={{ left: -padding, top: borderHeight / 2 - handleSize / 2, width: handleSize, height: handleSize }}
            onMouseDown={(e) => startResize(e, 'w')}
          />
          <div
            className="absolute cursor-ew-resize z-50"
            style={{ right: -padding, top: borderHeight / 2 - handleSize / 2, width: handleSize, height: handleSize }}
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
          className="px-0 py-0 bg-transparent border-none outline-none relative z-10 w-auto min-w-[1ch]"
          style={{
            fontSize: element.textStyle?.fontSize || 20,
            fontFamily: element.textStyle?.fontFamily || 'var(--font-handwritten), cursive',
            fontWeight: element.textStyle?.fontWeight || 'normal',
            textAlign: element.textStyle?.textAlign || 'left',
            color: element.color || '#1f2937',
            caretColor: element.color || '#1f2937',
            width: `${Math.max(1, localContent.length)}ch`,
          }}
        />
      ) : (
        <div
          ref={contentRef}
          className="px-0 py-0 whitespace-nowrap relative z-10"
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