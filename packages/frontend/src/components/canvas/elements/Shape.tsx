'use client';

import React, { useRef, useEffect, useState } from 'react';
import rough from 'roughjs';
import { useCanvasStore } from '@/store/canvas-store';
import { useSocket } from '@/contexts/socket-context';
import { cn } from '@/lib/utils';
import type { CanvasElement } from '@/types/canvas';

interface ShapeProps {
  element: CanvasElement;
}

type HandlePosition = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

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
  const [isHovered, setIsHovered] = useState(false);
  const { selectedIds, setSelectedId, updateElement, lockElement, unlockElement, userId, userRole, tool } = useCanvasStore();
  const { emitElementUpdate, emitElementLock, emitElementUnlock } = useSocket();

  const isSelected = selectedIds.has(element.id);
  const isLocked = element.locked && element.lockedBy !== userId;
  const isEditing = element.locked && element.lockedBy === userId;
  const strokeColor = element.color || STROKE_COLORS[0];
  const showSelection = isSelected || isHovered;

  useEffect(() => {
    if (!svgRef.current) return;

    const rc = rough.svg(svgRef.current);
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
      seed: element.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0),
    };

    let node: SVGElement;
    if (element.shapeType === 'circle') {
      node = rc.ellipse(width / 2, height / 2, width - padding * 2, height - padding * 2, options);
    } else if (element.shapeType === 'line') {
      node = rc.line(padding, height / 2, width - padding, height / 2, options);
    } else if (element.shapeType === 'triangle') {
      node = rc.polygon([
        [width / 2, padding],
        [padding, height - padding],
        [width - padding, height - padding]
      ], options);
    } else if (element.shapeType === 'diamond') {
      node = rc.polygon([
        [width / 2, padding],
        [width - padding, height / 2],
        [width / 2, height - padding],
        [padding, height / 2]
      ], options);
    } else if (element.shapeType === 'hexagon') {
      const hexPoints = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        hexPoints.push([
          width / 2 + (width / 2 - padding) * Math.cos(angle),
          height / 2 + (height / 2 - padding) * Math.sin(angle)
        ]);
      }
      node = rc.polygon(hexPoints, options);
    } else if (element.shapeType === 'star') {
      const starPoints = [];
      const outerRadius = Math.min(width, height) / 2 - padding;
      const innerRadius = outerRadius * 0.4;
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        starPoints.push([
          width / 2 + radius * Math.cos(angle),
          height / 2 + radius * Math.sin(angle)
        ]);
      }
      node = rc.polygon(starPoints, options);
    } else if (element.shapeType === 'arrow') {
      const x1 = padding;
      const y1 = height / 2;
      const x2 = width - padding;
      const y2 = height / 2;
      node = rc.line(x1, y1, x2, y2, options);

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

  const startResize = (e: React.MouseEvent, position: HandlePosition) => {
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
          newWidth = Math.max(20, startSize.width - dx);
          newHeight = Math.max(20, startSize.height - dy);
          newX = startPos.x + startSize.width - newWidth;
          newY = startPos.y + startSize.height - newHeight;
          break;
        case 'ne':
          newWidth = Math.max(20, startSize.width + dx);
          newHeight = Math.max(20, startSize.height - dy);
          newY = startPos.y + startSize.height - newHeight;
          break;
        case 'sw':
          newWidth = Math.max(20, startSize.width - dx);
          newHeight = Math.max(20, startSize.height + dy);
          newX = startPos.x + startSize.width - newWidth;
          break;
        case 'se':
          newWidth = Math.max(20, startSize.width + dx);
          newHeight = Math.max(20, startSize.height + dy);
          break;
        case 'n':
          newHeight = Math.max(20, startSize.height - dy);
          newY = startPos.y + startSize.height - newHeight;
          break;
        case 's':
          newHeight = Math.max(20, startSize.height + dy);
          break;
        case 'e':
          newWidth = Math.max(20, startSize.width + dx);
          break;
        case 'w':
          newWidth = Math.max(20, startSize.width - dx);
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

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    if (tool !== 'select') return;
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

  const handleSize = 8;

  return (
    <div
      className={cn(
        'absolute select-none group outline-none',
        isSelected ? 'cursor-move' : 'cursor-move',
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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      tabIndex={0}
      onBlur={handleBlur}
    >
      <svg
        ref={svgRef}
        width={element.size.width}
        height={element.size.height}
        style={{ overflow: 'visible' }}
      />

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
            style={{
              left: -handleSize / 2,
              top: -handleSize / 2,
              width: handleSize,
              height: handleSize,
              cursor: 'nwse-resize',
            }}
            onMouseDown={(e) => startResize(e, 'nw')}
          />
          <div
            className="absolute bg-white border-2 border-blue-500 rounded-sm z-50"
            style={{
              right: -handleSize / 2,
              top: -handleSize / 2,
              width: handleSize,
              height: handleSize,
              cursor: 'nesw-resize',
            }}
            onMouseDown={(e) => startResize(e, 'ne')}
          />
          <div
            className="absolute bg-white border-2 border-blue-500 rounded-sm z-50"
            style={{
              left: -handleSize / 2,
              bottom: -handleSize / 2,
              width: handleSize,
              height: handleSize,
              cursor: 'nesw-resize',
            }}
            onMouseDown={(e) => startResize(e, 'sw')}
          />
          <div
            className="absolute bg-white border-2 border-blue-500 rounded-sm z-50"
            style={{
              right: -handleSize / 2,
              bottom: -handleSize / 2,
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
              left: element.size.width / 2 - handleSize / 2,
              top: -handleSize / 2,
              width: handleSize,
              height: handleSize,
              cursor: 'ns-resize',
            }}
            onMouseDown={(e) => startResize(e, 'n')}
          />
          <div
            className="absolute bg-white border-2 border-blue-500 rounded-sm z-50"
            style={{
              left: element.size.width / 2 - handleSize / 2,
              bottom: -handleSize / 2,
              width: handleSize,
              height: handleSize,
              cursor: 'ns-resize',
            }}
            onMouseDown={(e) => startResize(e, 's')}
          />
          <div
            className="absolute bg-white border-2 border-blue-500 rounded-sm z-50"
            style={{
              left: -handleSize / 2,
              top: element.size.height / 2 - handleSize / 2,
              width: handleSize,
              height: handleSize,
              cursor: 'ew-resize',
            }}
            onMouseDown={(e) => startResize(e, 'w')}
          />
          <div
            className="absolute bg-white border-2 border-blue-500 rounded-sm z-50"
            style={{
              right: -handleSize / 2,
              top: element.size.height / 2 - handleSize / 2,
              width: handleSize,
              height: handleSize,
              cursor: 'ew-resize',
            }}
            onMouseDown={(e) => startResize(e, 'e')}
          />
        </>
      )}
    </div>
  );
}