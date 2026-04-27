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
import type { Position, CanvasElement } from '@/types/canvas';

export function InfiniteCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDrawingShape, setIsDrawingShape] = useState(false);
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [boxStart, setBoxStart] = useState<Position | null>(null);
  const [boxEnd, setBoxEnd] = useState<Position | null>(null);
  const [shapePreview, setShapePreview] = useState<{ start: Position; end: Position } | null>(null);
  const [dragStart, setDragStart] = useState<Position | null>(null);
  const [drawPoints, setDrawPoints] = useState<Position[]>([]);
  const [showTimeTravel, setShowTimeTravel] = useState(false);
  const [isErasing, setIsErasing] = useState(false);

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
    undo,
    redo,
  } = useCanvasStore();

  const { emitCursorMove, emitElementCreate, emitElementUpdate, emitElementDelete } = useSocket();

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(viewportZoom * delta, 0.1), 5);
    setViewportZoom(newZoom);
  }, [viewportZoom, setViewportZoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const x = (e.clientX - canvasRect.left - viewportPosition.x) / viewportZoom;
    const y = (e.clientY - canvasRect.top - viewportPosition.y) / viewportZoom;

    // Pan tool or middle mouse button
    if (e.button === 1 || (e.button === 0 && tool === 'pan')) {
      setIsPanning(true);
      setDragStart({ x: e.clientX - viewportPosition.x, y: e.clientY - viewportPosition.y });
      return;
    }

    // Eraser tool
    if (tool === 'eraser') {
      setIsErasing(true);
      // Find element under cursor and delete
      elements.forEach((element) => {
        if (isPointInElement(x, y, element)) {
          emitElementDelete(element.id);
          deleteElement(element.id);
        }
      });
      return;
    }

    // Select tool - click to select element OR start box selection
    if (tool === 'select') {
      // Check if clicking on an element
      let clickedElement: CanvasElement | null = null;
      elements.forEach((element) => {
        if (isPointInElement(x, y, element)) {
          clickedElement = element;
        }
      });

      if (clickedElement) {
        setSelectedId(clickedElement.id);
        setIsDragging(true);
        setDragStart({ x, y });
      } else {
        // Start box selection on empty area
        setIsBoxSelecting(true);
        setBoxStart({ x, y });
        setBoxEnd({ x, y });
      }
      return;
    }

    // Draw tool
    if (tool === 'draw') {
      setIsDragging(true);
      setDrawPoints([{ x: x, y: y }]);
      return;
    }

    // Shape tool - start drawing rectangle
    if (tool === 'shape') {
      setIsDrawingShape(true);
      setShapeStart({ x, y });
      setShapePreview({ start: { x, y }, end: { x, y } });
      return;
    }

    // Create elements on click
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
  }, [tool, viewportPosition, viewportZoom, userId, addElement, setSelectedId, shapeType, emitElementCreate, elements, deleteElement, emitElementDelete]);

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
      setDrawPoints((prev) => [...prev, { x: x, y: y }]);
    }

    // Shape tool - update preview
    if (isDrawingShape && tool === 'shape' && shapeStart) {
      setShapePreview({ start: shapeStart, end: { x, y } });
      return;
    }

    // Eraser tool - delete elements under cursor
    if (isErasing && tool === 'eraser') {
      elements.forEach((element) => {
        if (isPointInElement(x, y, element)) {
          emitElementDelete(element.id);
          deleteElement(element.id);
        }
      });
    }

    // Box selection update
    if (isBoxSelecting && boxStart) {
      setBoxEnd({ x, y });
    }
  }, [isPanning, isDragging, isErasing, isBoxSelecting, boxStart, viewportPosition, tool, emitCursorMove, setViewportPosition, elements, deleteElement, emitElementDelete]);

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

    // Create shape on mouse up (paint style)
    if (isDrawingShape && tool === 'shape' && shapePreview) {
      const width = Math.abs(shapePreview.end.x - shapePreview.start.x);
      const height = Math.abs(shapePreview.end.y - shapePreview.start.y);
      if (width > 5 && height > 5) {
        const element = addElement({
          type: 'shape',
          position: {
            x: Math.min(shapePreview.start.x, shapePreview.end.x),
            y: Math.min(shapePreview.start.y, shapePreview.end.y),
          },
          size: { width, height },
          content: '',
          shapeType,
          color: '#374151',
          locked: false,
          createdBy: userId,
        });
        emitElementCreate(element);
        setSelectedId(element.id);
      }
      setShapePreview(null);
      setShapeStart(null);
    }

    // Select elements in box selection
    if (isBoxSelecting && boxStart && boxEnd) {
      const box = {
        left: Math.min(boxStart.x, boxEnd.x),
        right: Math.max(boxStart.x, boxEnd.x),
        top: Math.min(boxStart.y, boxEnd.y),
        bottom: Math.max(boxStart.y, boxEnd.y),
      };

      let firstId: string | null = null;
      elements.forEach((element) => {
        if (isElementInBox(element, box)) {
          if (!firstId) firstId = element.id;
        }
      });
      if (firstId) setSelectedId(firstId);
    }

    setIsDragging(false);
    setIsErasing(false);
    setIsDrawingShape(false);
    setIsBoxSelecting(false);
    setBoxStart(null);
    setBoxEnd(null);
    setDragStart(null);
  }, [isPanning, isDragging, isDrawingShape, tool, drawPoints, userId, addElement, emitElementCreate, boxStart, boxEnd, elements, setSelectedId, shapePreview, shapeType, selectedId, updateElement, emitElementUpdate]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setSelectedId(null);
    }
  }, [setSelectedId]);

  // Listen for element selection from child components
  useEffect(() => {
    const handleElementSelect = (e: CustomEvent) => {
      setSelectedId(e.detail);
    };
    window.addEventListener('canvas-element-select' as any, handleElementSelect);
    return () => window.removeEventListener('canvas-element-select' as any, handleElementSelect);
  }, []);

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
      data-canvas="true"
      className={cn(
        'w-full h-full overflow-hidden bg-slate-50 relative select-none',
        isPanning ? 'cursor-grabbing' : tool === 'pan' ? 'cursor-grab' : tool === 'eraser' ? 'cursor-cell' : tool === 'select' ? 'cursor-default' : 'cursor-crosshair'
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

        {/* Shape preview while dragging - actual rectangle outline */}
        {shapePreview && (
          <svg
            className="absolute pointer-events-none"
            style={{
              left: Math.min(shapePreview.start.x, shapePreview.end.x),
              top: Math.min(shapePreview.start.y, shapePreview.end.y),
              width: Math.abs(shapePreview.end.x - shapePreview.start.x),
              height: Math.abs(shapePreview.end.y - shapePreview.start.y),
            }}
          >
            <rect
              x="1"
              y="1"
              width={Math.abs(shapePreview.end.x - shapePreview.start.x) - 2}
              height={Math.abs(shapePreview.end.y - shapePreview.start.y) - 2}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeDasharray="5,5"
            />
          </svg>
        )}

        {/* Box selection while dragging */}
        {isBoxSelecting && boxStart && boxEnd && (
          <div
            className="absolute border-2 border-blue-500 border-dashed bg-blue-500/10 pointer-events-none"
            style={{
              left: Math.min(boxStart.x, boxEnd.x),
              top: Math.min(boxStart.y, boxEnd.y),
              width: Math.abs(boxEnd.x - boxStart.x),
              height: Math.abs(boxEnd.y - boxStart.y),
            }}
          />
        )}
      </div>

      <CursorPresence />
      <PresenceHeatmap visible={heatmapEnabled} />
      <PresenceZones visible={zonesEnabled} />
      <TimeTravel visible={showTimeTravel} onClose={() => setShowTimeTravel(false)} />

      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg px-3 py-2 text-sm">
        <span className="text-muted-foreground">Zoom: {Math.round(viewportZoom * 100)}%</span>
      </div>
    </div>
  );
}

// Helper function to check if point is in element
function isPointInElement(x: number, y: number, element: CanvasElement): boolean {
  const { position, size } = element;
  return (
    x >= position.x &&
    x <= position.x + size.width &&
    y >= position.y &&
    y <= position.y + size.height
  );
}

// Helper function to check if element is in selection box
function isElementInBox(element: CanvasElement, box: { left: number; right: number; top: number; bottom: number }): boolean {
  const { position, size } = element;
  return (
    position.x >= box.left &&
    position.x + size.width <= box.right &&
    position.y >= box.top &&
    position.y + size.height <= box.bottom
  );
}