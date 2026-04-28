'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import rough from 'roughjs';
import { useCanvasStore } from '@/store/canvas-store';
import { useSocket } from '@/contexts/socket-context';
import { cn } from '@/lib/utils';
import type { CanvasElement } from '@/types/canvas';

interface ShapeProps {
  element: CanvasElement;
}

const STROKE_COLORS = [
  '#374151', // gray-700
  '#ef4444', // red
  '#06b6d4', // cyan
  '#22c55e', // green
  '#8b5cf6', // purple
  '#f97316', // orange
];

export function Shape({ element }: ShapeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { selectedIds, setSelectedId, updateElement, lockElement, unlockElement, userId } = useCanvasStore();
  const { emitElementUpdate, emitElementLock, emitElementUnlock } = useSocket();

  const isSelected = selectedIds.has(element.id);
  const isLocked = element.locked && element.lockedBy !== userId;
  const isEditing = element.locked && element.lockedBy === userId;
  const strokeColor = element.color || STROKE_COLORS[0];

  useEffect(() => {
    if (!svgRef.current) return;
    
    const rc = rough.svg(svgRef.current);
    // Clear previous drawings
    while (svgRef.current.firstChild) {
      svgRef.current.removeChild(svgRef.current.firstChild);
    }

    const { width, height } = element.size;
    const padding = 5;
    const options = {
      stroke: strokeColor,
      strokeWidth: isSelected ? 2.5 : 2,
      roughness: 1.5,
      bowing: 1.5,
      seed: element.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0), // Deterministic seed
    };

    let node: SVGElement;
    if (element.shapeType === 'circle') {
      node = rc.ellipse(width / 2, height / 2, width - padding * 2, height - padding * 2, options);
    } else if (element.shapeType === 'arrow') {
      const x1 = padding;
      const y1 = padding;
      const x2 = width - padding;
      const y2 = height - padding;
      node = rc.line(x1, y1, x2, y2, options);
      
      // Arrow head
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headLength = 15;
      const head1X = x2 - headLength * Math.cos(angle - Math.PI / 6);
      const head1Y = y2 - headLength * Math.sin(angle - Math.PI / 6);
      const head2X = x2 - headLength * Math.cos(angle + Math.PI / 6);
      const head2Y = y2 - headLength * Math.sin(angle + Math.PI / 6);
      
      const head1 = rc.line(x2, y2, head1X, head1Y, options);
      const head2 = rc.line(x2, y2, head2X, head2Y, options);
      svgRef.current.appendChild(node);
      svgRef.current.appendChild(head1);
      svgRef.current.appendChild(head2);
      return;
    } else {
      node = rc.rectangle(padding, padding, width - padding * 2, height - padding * 2, options);
    }
    
    svgRef.current.appendChild(node);
  }, [element.shapeType, element.size, element.color, element.id, isSelected, strokeColor]);

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

  return (
    <div
      className={cn(
        'absolute select-none cursor-move group',
        isSelected && 'ring-1 ring-blue-400 ring-offset-4 rounded-sm',
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
      <svg
        ref={svgRef}
        width={element.size.width}
        height={element.size.height}
        style={{ overflow: 'visible' }}
      />

      {isSelected && !isLocked && (
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex gap-1 bg-white rounded-lg shadow-lg p-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          {STROKE_COLORS.map((color) => (
            <button
              key={color}
              onClick={(e) => {
                e.stopPropagation();
                handleColorChange(color);
              }}
              className={cn(
                'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
                element.color === color ? 'border-gray-800' : 'border-transparent'
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      )}

      {isSelected && !isLocked && (
        <div
          className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-se-resize z-10"
          onMouseDown={(e) => {
            e.stopPropagation();
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
      )}
    </div>
  );
}
