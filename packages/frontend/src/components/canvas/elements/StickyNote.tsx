'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { useSocket } from '@/contexts/socket-context';
import { cn } from '@/lib/utils';
import type { CanvasElement } from '@/types/canvas';

interface StickyNoteProps {
  element: CanvasElement;
}

type HandlePosition = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

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
  const [isHovered, setIsHovered] = useState(false);
  const [localContent, setLocalContent] = useState(element.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { selectedIds, setSelectedId, updateElement, lockElement, unlockElement, userId, userRole, tool } = useCanvasStore();
  const { emitElementUpdate, emitElementLock, emitElementUnlock } = useSocket();

  const isSelected = selectedIds.has(element.id);
  // Only faded when locked by ANOTHER user, not yourself
  const isLockedByOther = element.locked && element.lockedBy !== userId;
  const isLocked = element.locked;
  const showSelection = isSelected || isHovered;

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

  const startResize = (e: React.MouseEvent, position: HandlePosition) => {
    e.stopPropagation();
    e.preventDefault();

    // Locked = can't resize
    if (element.locked) return;

    if (userRole === 'Viewer') {
      alert('You are in Viewer mode. Ask a Lead or Contributor to edit.');
      return;
    }

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...element.position };
    const startSize = { ...element.size };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const state = useCanvasStore.getState();
      const dx = (moveEvent.clientX - startX) / state.viewportZoom;
      const dy = (moveEvent.clientY - startY) / state.viewportZoom;

      let newWidth = startSize.width;
      let newHeight = startSize.height;
      let newX = startPos.x;
      let newY = startPos.y;

      switch (position) {
        case 'nw':
          newWidth = Math.max(100, startSize.width - dx);
          newHeight = Math.max(80, startSize.height - dy);
          newX = startPos.x + startSize.width - newWidth;
          newY = startPos.y + startSize.height - newHeight;
          break;
        case 'ne':
          newWidth = Math.max(100, startSize.width + dx);
          newHeight = Math.max(80, startSize.height - dy);
          newY = startPos.y + startSize.height - newHeight;
          break;
        case 'sw':
          newWidth = Math.max(100, startSize.width - dx);
          newHeight = Math.max(80, startSize.height + dy);
          newX = startPos.x + startSize.width - newWidth;
          break;
        case 'se':
          newWidth = Math.max(100, startSize.width + dx);
          newHeight = Math.max(80, startSize.height + dy);
          break;
        case 'n':
          newHeight = Math.max(80, startSize.height - dy);
          newY = startPos.y + startSize.height - newHeight;
          break;
        case 's':
          newHeight = Math.max(80, startSize.height + dy);
          break;
        case 'e':
          newWidth = Math.max(100, startSize.width + dx);
          break;
        case 'w':
          newWidth = Math.max(100, startSize.width - dx);
          newX = startPos.x + startSize.width - newWidth;
          break;
      }

      updateElement(element.id, {
        position: { x: newX, y: newY },
        size: { width: newWidth, height: newHeight },
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

  const handleSize = 8;

  return (
    <div
      className={cn(
        'absolute select-none transition-shadow outline-none',
        isSelected && 'ring-2 ring-primary',
        isLockedByOther && 'pointer-events-none',
        !isLocked && tool !== 'select' && tool !== 'sticky' && 'pointer-events-none'
      )}
      style={{
        left: element.position.x,
        top: element.position.y,
        width: element.size.width,
        height: element.size.height,
        backgroundColor: element.color || COLORS[0],
      }}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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

      {/* Selection outline with 8 handles */}
      {showSelection && !isLocked && (
        <>
          {/* Selection border */}
          <div
            className="absolute inset-0 pointer-events-none border-2 border-blue-500 rounded-sm"
            style={{ zIndex: 1 }}
          />

          {/* Corner handles */}
          <div
            className="absolute bg-white border-2 border-blue-500 rounded-sm z-50"
            style={{ left: -handleSize / 2, top: -handleSize / 2, width: handleSize, height: handleSize, cursor: 'nwse-resize' }}
            onMouseDown={(e) => startResize(e, 'nw')}
          />
          <div
            className="absolute bg-white border-2 border-blue-500 rounded-sm z-50"
            style={{ right: -handleSize / 2, top: -handleSize / 2, width: handleSize, height: handleSize, cursor: 'nesw-resize' }}
            onMouseDown={(e) => startResize(e, 'ne')}
          />
          <div
            className="absolute bg-white border-2 border-blue-500 rounded-sm z-50"
            style={{ left: -handleSize / 2, bottom: -handleSize / 2, width: handleSize, height: handleSize, cursor: 'nesw-resize' }}
            onMouseDown={(e) => startResize(e, 'sw')}
          />
          <div
            className="absolute bg-white border-2 border-blue-500 rounded-sm z-50"
            style={{ right: -handleSize / 2, bottom: -handleSize / 2, width: handleSize, height: handleSize, cursor: 'nwse-resize' }}
            onMouseDown={(e) => startResize(e, 'se')}
          />

          {/* Edge handles */}
          <div
            className="absolute bg-white border-2 border-blue-500 rounded-sm z-50"
            style={{ left: element.size.width / 2 - handleSize / 2, top: -handleSize / 2, width: handleSize, height: handleSize, cursor: 'ns-resize' }}
            onMouseDown={(e) => startResize(e, 'n')}
          />
          <div
            className="absolute bg-white border-2 border-blue-500 rounded-sm z-50"
            style={{ left: element.size.width / 2 - handleSize / 2, bottom: -handleSize / 2, width: handleSize, height: handleSize, cursor: 'ns-resize' }}
            onMouseDown={(e) => startResize(e, 's')}
          />
          <div
            className="absolute bg-white border-2 border-blue-500 rounded-sm z-50"
            style={{ left: -handleSize / 2, top: element.size.height / 2 - handleSize / 2, width: handleSize, height: handleSize, cursor: 'ew-resize' }}
            onMouseDown={(e) => startResize(e, 'w')}
          />
          <div
            className="absolute bg-white border-2 border-blue-500 rounded-sm z-50"
            style={{ right: -handleSize / 2, top: element.size.height / 2 - handleSize / 2, width: handleSize, height: handleSize, cursor: 'ew-resize' }}
            onMouseDown={(e) => startResize(e, 'e')}
          />
        </>
      )}

      {element.locked && element.lockedBy === userId && (
        <div className="absolute -top-6 right-0 text-xs bg-primary text-white px-2 py-1 rounded">
          Editing
        </div>
      )}

      {/* Intent Tag Badge */}
      {element.intentTag && (
        <div className={cn(
          'absolute -top-6 left-0 px-2 py-1 text-xs rounded whitespace-nowrap',
          element.intentTag.type === 'action_item' && 'bg-red-100 text-red-700 border border-red-200',
          element.intentTag.type === 'decision' && 'bg-blue-100 text-blue-700 border border-blue-200',
          element.intentTag.type === 'open_question' && 'bg-yellow-100 text-yellow-700 border border-yellow-200',
          element.intentTag.type === 'reference' && 'bg-gray-100 text-gray-600 border border-gray-200'
        )}>
          {element.intentTag.type.replace('_', ' ')} {Math.round(element.intentTag.confidence * 100)}%
        </div>
      )}
    </div>
  );
}
