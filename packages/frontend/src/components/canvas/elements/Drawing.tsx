'use client';

import React from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { useSocket } from '@/contexts/socket-context';
import { cn } from '@/lib/utils';
import type { CanvasElement, Position } from '@/types/canvas';

interface DrawingProps {
  element: CanvasElement;
}

function getBezierPath(points: Position[]): string {
  if (points.length < 2) return '';

  const minX = Math.min(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));

  const relativePoints = points.map(p => ({
    x: p.x - minX,
    y: p.y - minY,
  }));

  if (relativePoints.length === 2) {
    return `M ${relativePoints[0].x} ${relativePoints[0].y} L ${relativePoints[1].x} ${relativePoints[1].y}`;
  }

  let path = `M ${relativePoints[0].x} ${relativePoints[0].y}`;

  for (let i = 1; i < relativePoints.length - 1; i++) {
    const prev = relativePoints[i - 1];
    const curr = relativePoints[i];
    const next = relativePoints[i + 1];

    const cp1x = prev.x + (curr.x - prev.x) * 0.5;
    const cp1y = prev.y + (curr.y - prev.y) * 0.5;
    const cp2x = curr.x + (next.x - curr.x) * 0.5;
    const cp2y = curr.y + (next.y - curr.y) * 0.5;

    path += ` Q ${curr.x} ${curr.y} ${cp2x} ${cp2y}`;
  }

  const last = relativePoints[relativePoints.length - 1];
  path += ` L ${last.x} ${last.y}`;

  return path;
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

  const pathData = getBezierPath(element.points);

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
        width: maxX - minX + 20,
        height: maxY - minY + 20,
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
        transform={`translate(-minX, -minY)`}
      />
    </svg>
  );
}