'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { useSocket } from '@/contexts/socket-context';
import { StickyNote } from './elements/StickyNote';
import { Shape } from './elements/Shape';
import { TextBlock } from './elements/TextBlock';
import { Drawing } from './elements/Drawing';
import { CursorPresence } from './CursorPresence';
import { PresenceHeatmap, usePresenceHeatmap } from './PresenceHeatmap';
import { PresenceZones, usePresenceZones } from './PresenceZones';
import { TimeTravel } from './TimeTravel';
import { cn } from '@/lib/utils';
import type { Position } from '@/types/canvas';

export function InfiniteCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Position | null>(null);
  const [drawPoints, setDrawPoints] = useState<Position[]>([]);
  const [showTimeTravel, setShowTimeTravel] = useState(false);

  // Creative bonus feature toggles
  const { isEnabled: heatmapEnabled, toggle: toggleHeatmap } = usePresenceHeatmap();
  const { isEnabled: zonesEnabled, toggle: toggleZones } = usePresenceZones();

  const {
    elements,
    selectedId,
    tool,
    shapeType,
    viewportPosition,
    viewportZoom,
    userId,
    setSelectedId,
    setViewportPosition,
    setViewportZoom,
    addElement,
    updateElement,
    deleteElement,
  } = useCanvasStore();

  const { emitCursorMove, emitElementCreate, emitElementUpdate, emitElementDelete } = useSocket();

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(viewportZoom * delta, 0.1), 5);
    setViewportZoom(newZoom);
  }, [viewportZoom, setViewportZoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && tool === 'pan')) {
      setIsPanning(true);
      setDragStart({ x: e.clientX - viewportPosition.x, y: e.clientY - viewportPosition.y });
      return;
    }

    if (tool === 'draw') {
      setIsDragging(true);
      setDrawPoints([{ x: e.clientX, y: e.clientY }]);
      return;
    }

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const x = (e.clientX - canvasRect.left - viewportPosition.x) / viewportZoom;
    const y = (e.clientY - canvasRect.top - viewportPosition.y) / viewportZoom;

    if (tool === 'sticky') {
      const element = addElement({
        type: 'sticky',
        position: { x: x - 100, y: y - 50 },
        size: { width: 200, height: 150 },
        content: '',
        color: '#fef08a',
        locked: false,
        createdBy: userId,
      });
      emitElementCreate(element);
      setSelectedId(element.id);
    } else if (tool === 'shape') {
      const element = addElement({
        type: 'shape',
        position: { x: x - 50, y: y - 50 },
        size: { width: 100, height: 100 },
        content: '',
        shapeType,
        color: '#e2e8f0',
        locked: false,
        createdBy: userId,
      });
      emitElementCreate(element);
      setSelectedId(element.id);
    } else if (tool === 'text') {
      const element = addElement({
        type: 'text',
        position: { x, y },
        size: { width: 200, height: 40 },
        content: 'Double-click to edit',
        locked: false,
        createdBy: userId,
      });
      emitElementCreate(element);
      setSelectedId(element.id);
    }
  }, [tool, viewportPosition, viewportZoom, userId, addElement, setSelectedId, shapeType, emitElementCreate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const x = (e.clientX - canvasRect.left - viewportPosition.x) / viewportZoom;
    const y = (e.clientY - canvasRect.top - viewportPosition.y) / viewportZoom;

    emitCursorMove({ x: e.clientX, y: e.clientY });

    if (isPanning && dragStart) {
      setViewportPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
      return;
    }

    if (isDragging && tool === 'draw') {
      setDrawPoints((prev) => [...prev, { x: e.clientX, y: e.clientY }]);
    }
  }, [isPanning, isDragging, dragStart, viewportPosition, tool, emitCursorMove, setViewportPosition]);

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      setDragStart(null);
    }

    if (isDragging && tool === 'draw' && drawPoints.length > 1) {
      const element = addElement({
        type: 'drawing',
        position: { x: 0, y: 0 },
        size: { width: 0, height: 0 },
        content: '',
        points: drawPoints,
        color: '#1f2937',
        locked: false,
        createdBy: userId,
      });
      emitElementCreate(element);
      setDrawPoints([]);
    }

    setIsDragging(false);
  }, [isPanning, isDragging, tool, drawPoints, userId, addElement, emitElementCreate]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setSelectedId(null);
    }
  }, [setSelectedId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        emitElementDelete(selectedId);
        deleteElement(selectedId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, deleteElement, emitElementDelete]);

  return (
    <div
      ref={canvasRef}
      className={cn(
        'w-full h-full overflow-hidden bg-slate-50 relative',
        isPanning ? 'cursor-grabbing' : tool === 'pan' ? 'cursor-grab' : 'cursor-crosshair'
      )}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleCanvasClick}
    >
      <div
        className="absolute inset-0 origin-top-left"
        style={{
          transform: `translate(${viewportPosition.x}px, ${viewportPosition.y}px) scale(${viewportZoom})`,
        }}
      >
        {Array.from(elements.values()).map((element) => {
          switch (element.type) {
            case 'sticky':
              return <StickyNote key={element.id} element={element} />;
            case 'shape':
              return <Shape key={element.id} element={element} />;
            case 'text':
              return <TextBlock key={element.id} element={element} />;
            case 'drawing':
              return <Drawing key={element.id} element={element} />;
            default:
              return null;
          }
        })}

        {isDragging && tool === 'draw' && drawPoints.length > 1 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
            {(() => {
              const minX = Math.min(...drawPoints.map(p => p.x));
              const minY = Math.min(...drawPoints.map(p => p.y));
              const maxX = Math.max(...drawPoints.map(p => p.x));
              const maxY = Math.max(...drawPoints.map(p => p.y));

              const relativePoints = drawPoints.map(p => ({
                x: p.x - minX,
                y: p.y - minY,
              }));

              let path = `M ${relativePoints[0].x} ${relativePoints[0].y}`;
              for (let i = 1; i < relativePoints.length - 1; i++) {
                const curr = relativePoints[i];
                const next = relativePoints[i + 1];
                const cp2x = curr.x + (next.x - curr.x) * 0.5;
                const cp2y = curr.y + (next.y - curr.y) * 0.5;
                path += ` Q ${curr.x} ${curr.y} ${cp2x} ${cp2y}`;
              }
              const last = relativePoints[relativePoints.length - 1];
              path += ` L ${last.x} ${last.y}`;

              return (
                <g transform={`translate(${minX}, ${minY})`}>
                  <path
                    d={path}
                    fill="none"
                    stroke="#1f2937"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })()}
          </svg>
        )}
      </div>

      <CursorPresence />

      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg px-3 py-2 text-sm">
        <span className="text-muted-foreground">Zoom: {Math.round(viewportZoom * 100)}%</span>
      </div>
    </div>
  );
}