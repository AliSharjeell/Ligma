'use client';

import React, { useRef, useEffect } from 'react';
import rough from 'roughjs';
import { useCanvasStore } from '@/store/canvas-store';
import { useSocket } from '@/contexts/socket-context';
import { cn } from '@/lib/utils';
import type { CanvasElement, Position } from '@/types/canvas';

interface DrawingProps {
  element: CanvasElement;
}

export function Drawing({ element }: DrawingProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { selectedIds, setSelectedId, updateElement, userId, userRole, tool } = useCanvasStore();
  const { emitElementUpdate } = useSocket();

  const isSelected = selectedIds.has(element.id);
  // Only faded when locked by ANOTHER user, not yourself
  const isLockedByOther = element.locked && element.lockedBy !== userId;
  const isLocked = element.locked;

  useEffect(() => {
    if (!svgRef.current || !element.points || element.points.length < 2) return;

    const rc = rough.svg(svgRef.current);
    while (svgRef.current.firstChild) {
      svgRef.current.removeChild(svgRef.current.firstChild);
    }

    const minX = Math.min(...element.points.map(p => p.x));
    const minY = Math.min(...element.points.map(p => p.y));

    const relativePoints: [number, number][] = element.points.map(p => [
      p.x - minX,
      p.y - minY,
    ]);

    const node = rc.curve(relativePoints, {
      stroke: element.color || '#1f2937',
      strokeWidth: isSelected ? 2.5 : 2,
      roughness: 1,
    });

    svgRef.current.appendChild(node);
  }, [element.points, element.color, isSelected]);

  if (!element.points || element.points.length < 2) return null;

  const minX = Math.min(...element.points.map(p => p.x));
  const minY = Math.min(...element.points.map(p => p.y));
  const maxX = Math.max(...element.points.map(p => p.x));
  const maxY = Math.max(...element.points.map(p => p.y));

  const actualPosition = { x: minX, y: minY };
  const actualSize = { width: maxX - minX, height: maxY - minY };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Locked by anyone = can't move
    if (element.locked) return;
    if (tool === 'select') {
      setSelectedId(element.id);
    }
    if (userRole === 'Viewer') return;
    // For other tools, let the event propagate to canvas

    const startX = e.clientX;
    const startY = e.clientY;
    const startPoints = [...element.points!];

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const state = useCanvasStore.getState();
      const dx = (moveEvent.clientX - startX) / state.viewportZoom;
      const dy = (moveEvent.clientY - startY) / state.viewportZoom;

      const newPoints = startPoints.map(p => ({
        x: p.x + dx,
        y: p.y + dy,
      }));

      const newMinX = Math.min(...newPoints.map(p => p.x));
      const newMinY = Math.min(...newPoints.map(p => p.y));

      updateElement(element.id, {
        points: newPoints,
        position: { x: newMinX, y: newMinY },
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

  return (
    <div
      className={cn(
        'absolute cursor-move',
        isSelected && 'ring-1 ring-blue-400 ring-offset-4 rounded-sm',
        isLockedByOther && 'pointer-events-none',
        !isLocked && tool !== 'select' && 'pointer-events-none'
      )}
      style={{
        left: actualPosition.x,
        top: actualPosition.y,
        width: actualSize.width,
        height: actualSize.height,
      }}
      onMouseDown={handleMouseDown}
    >
      <svg
        ref={svgRef}
        width={maxX - minX}
        height={maxY - minY}
        style={{ overflow: 'visible' }}
      />
    </div>
  );
}
