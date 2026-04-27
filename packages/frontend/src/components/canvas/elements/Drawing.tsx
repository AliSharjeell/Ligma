'use client';

import React from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { useSocket } from '@/contexts/socket-context';
import { cn } from '@/lib/utils';
import type { CanvasElement, Position } from '@/types/canvas';

interface DrawingProps {
  element: CanvasElement;
}

export function Drawing({ element }: DrawingProps) {
  const { selectedId, setSelectedId, updateElement, lockElement, unlockElement, userId, viewportPosition, viewportZoom } = useCanvasStore();
  const { emitElementUpdate, emitElementLock, emitElementUnlock } = useSocket();

  const isSelected = selectedId === element.id;
  const isLocked = element.locked && element.lockedBy !== userId;

  if (!element.points || element.points.length < 2) return null;

  const minX = Math.min(...element.points.map(p => p.x));
  const minY = Math.min(...element.points.map(p => p.y));
  const maxX = Math.max(...element.points.map(p => p.x));
  const maxY = Math.max(...element.points.map(p => p.y));

  const relativePoints = element.points.map(p => ({
    x: p.x - minX,
    y: p.y - minY,
  }));

  const pathData = relativePoints.reduce((acc, point, i) => {
    if (i === 0) return `M ${point.x} ${point.y}`;
    return `${acc} L ${point.x} ${point.y}`;
  }, '');

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    setSelectedId(element.id);
  };

  return (
    <svg
      className={cn(
        'absolute pointer-events-none',
        isSelected && 'ring-2 ring-primary',
        isLocked && 'opacity-50'
      )}
      style={{
        left: minX,
        top: minY,
        width: maxX - minX + 10,
        height: maxY - minY + 10,
      }}
      onMouseDown={handleMouseDown}
    >
      <path
        d={pathData}
        fill="none"
        stroke={element.color || '#1f2937'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={`translate(0, 0)`}
      />
    </svg>
  );
}