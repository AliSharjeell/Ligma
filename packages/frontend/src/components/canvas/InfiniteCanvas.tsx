'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import rough from 'roughjs';
import { useCanvasStore } from '@/store/canvas-store';
import { useSocket } from '@/contexts/socket-context';
import { StickyNote } from './elements/StickyNote';
import { Shape } from './elements/Shape';
import { TextBlock } from './elements/TextBlock';
import { Drawing } from './elements/Drawing';
import { CursorPresence } from './CursorPresence';
import { PresenceHeatmap } from './PresenceHeatmap';
import { PresenceZones } from './PresenceZones';
import { TimeTravel } from './TimeTravel';
import { cn } from '@/lib/utils';
import type { Position, CanvasElement } from '@/types/canvas';

export function InfiniteCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const previewSvgRef = useRef<SVGSVGElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDrawingShape, setIsDrawingShape] = useState(false);
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [boxStart, setBoxStart] = useState<Position | null>(null);
  const [boxEnd, setBoxEnd] = useState<Position | null>(null);
  const [shapeStart, setShapeStart] = useState<Position | null>(null);
  const [shapePreview, setShapePreview] = useState<{ start: Position; end: Position } | null>(null);
  const [dragStart, setDragStart] = useState<Position | null>(null);
  const [drawPoints, setDrawPoints] = useState<Position[]>([]);
  const [isErasing, setIsErasing] = useState(false);
  const suppressClickClearRef = useRef(false);

  const {
    elements,
    selectedIds,
    tool,
    shapeType,
    drawColor,
    shapeColor,
    stickyColor,
    textColor,
    textFontSize,
    textFontFamily,
    textFontWeight,
    textAlign,
    viewportPosition,
    viewportZoom,
    userId,
    setSelectedId,
    setSelectedIds,
    clearSelection,
    setViewportPosition,
    setViewportZoom,
    addElement,
    updateElement,
    deleteElement,
  } = useCanvasStore();

  const { emitCursorMove, emitElementCreate, emitElementUpdate, emitElementDelete } = useSocket();

  // Update rough preview
  useEffect(() => {
    if (!previewSvgRef.current) return;
    const rc = rough.svg(previewSvgRef.current);
    while (previewSvgRef.current.firstChild) {
      previewSvgRef.current.removeChild(previewSvgRef.current.firstChild);
    }

    if (isDrawingShape && shapePreview) {
      const x = Math.min(shapePreview.start.x, shapePreview.end.x);
      const y = Math.min(shapePreview.start.y, shapePreview.end.y);
      const w = Math.abs(shapePreview.end.x - shapePreview.start.x);
      const h = Math.abs(shapePreview.end.y - shapePreview.start.y);
      
      if (w > 2 && h > 2) {
        const options = { stroke: shapeColor, strokeWidth: 2, roughness: 1.5 };
        let node;
        if (shapeType === 'circle') {
          node = rc.ellipse(x + w / 2, y + h / 2, w, h, options);
        } else {
          node = rc.rectangle(x, y, w, h, options);
        }
        previewSvgRef.current.appendChild(node);
      }
    }

    if (isDragging && tool === 'draw' && drawPoints.length > 1) {
      const points: [number, number][] = drawPoints.map(p => [p.x, p.y]);
      const node = rc.curve(points, { stroke: drawColor, strokeWidth: 2, roughness: 1 });
      previewSvgRef.current.appendChild(node);
    }
  }, [isDrawingShape, shapePreview, shapeType, shapeColor, isDragging, tool, drawPoints, drawColor]);

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

    if (e.button === 1 || (e.button === 0 && tool === 'pan')) {
      setIsPanning(true);
      setDragStart({ x: e.clientX - viewportPosition.x, y: e.clientY - viewportPosition.y });
      return;
    }

    if (tool === 'eraser') {
      setIsErasing(true);
      elements.forEach((element) => {
        if (isPointInElement(x, y, element)) {
          emitElementDelete(element.id);
          deleteElement(element.id);
        }
      });
      return;
    }

    if (tool === 'select') {
      const elementsArray = Array.from(elements.values());
      const clickedElement = elementsArray.find((element) => isPointInElement(x, y, element));

      if (clickedElement) {
        if (e.shiftKey) {
          const newSelection = new Set(selectedIds);
          if (newSelection.has(clickedElement.id)) {
            newSelection.delete(clickedElement.id);
          } else {
            newSelection.add(clickedElement.id);
          }
          setSelectedIds(newSelection);
        } else {
          setSelectedId(clickedElement.id);
        }
        setIsDragging(true);
        setDragStart({ x, y });
      } else {
        clearSelection();
        setIsBoxSelecting(true);
        setBoxStart({ x, y });
        setBoxEnd({ x, y });
      }
      return;
    }

    if (tool === 'draw') {
      setIsDragging(true);
      setDrawPoints([{ x, y }]);
      return;
    }

    if (tool === 'shape') {
      setIsDrawingShape(true);
      setShapeStart({ x, y });
      setShapePreview({ start: { x, y }, end: { x, y } });
      return;
    }

    if (tool === 'sticky') {
      const element = addElement({
        type: 'sticky',
        position: { x: x - 100, y: y - 75 },
        size: { width: 200, height: 150 },
        content: '',
        color: stickyColor,
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
        content: '',
        color: textColor,
        textStyle: {
          fontSize: textFontSize,
          fontFamily: textFontFamily,
          fontWeight: textFontWeight,
          textAlign,
        },
        locked: false,
        createdBy: userId,
      });
      emitElementCreate(element);
      setSelectedId(element.id);
    }
  }, [tool, viewportPosition, viewportZoom, elements, selectedIds, setSelectedId, setSelectedIds, clearSelection, addElement, userId, stickyColor, textColor, textFontSize, textFontFamily, textFontWeight, textAlign, emitElementDelete, deleteElement, emitElementCreate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const x = (e.clientX - canvasRect.left - viewportPosition.x) / viewportZoom;
    const y = (e.clientY - canvasRect.top - viewportPosition.y) / viewportZoom;

    emitCursorMove({ x: e.clientX, y: e.clientY });

    if (isPanning && dragStart) {
      suppressClickClearRef.current = true;
      setViewportPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
      return;
    }

    if (isDragging && tool === 'draw') {
      suppressClickClearRef.current = true;
      setDrawPoints((prev) => [...prev, { x, y }]);
    }

    if (isDrawingShape && tool === 'shape' && shapeStart) {
      suppressClickClearRef.current = true;
      setShapePreview({ start: shapeStart, end: { x, y } });
      return;
    }

    if (isErasing && tool === 'eraser') {
      suppressClickClearRef.current = true;
      elements.forEach((element) => {
        if (isPointInElement(x, y, element)) {
          emitElementDelete(element.id);
          deleteElement(element.id);
        }
      });
    }

    if (isBoxSelecting && boxStart) {
      suppressClickClearRef.current = true;
      setBoxEnd({ x, y });
    }
  }, [isPanning, isDragging, isDrawingShape, isErasing, isBoxSelecting, dragStart, tool, viewportPosition, viewportZoom, shapeStart, boxStart, elements, emitCursorMove, setViewportPosition, emitElementDelete, deleteElement]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && tool === 'draw' && drawPoints.length > 1) {
      const element = addElement({
        type: 'drawing',
        position: { x: 0, y: 0 },
        size: { width: 0, height: 0 },
        content: '',
        points: drawPoints,
        color: drawColor,
        locked: false,
        createdBy: userId,
      });
      emitElementCreate(element);
      setDrawPoints([]);
    }

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
          color: shapeColor,
          locked: false,
          createdBy: userId,
        });
        emitElementCreate(element);
        setSelectedId(element.id);
      }
      setShapePreview(null);
      setShapeStart(null);
    }

    if (isBoxSelecting && boxStart && boxEnd) {
      const box = {
        left: Math.min(boxStart.x, boxEnd.x),
        right: Math.max(boxStart.x, boxEnd.x),
        top: Math.min(boxStart.y, boxEnd.y),
        bottom: Math.max(boxStart.y, boxEnd.y),
      };

      const selectedElementIds = new Set<string>();
      elements.forEach((element) => {
        if (isElementInBox(element, box)) {
          selectedElementIds.add(element.id);
        }
      });
      if (selectedElementIds.size > 0) {
        setSelectedIds(selectedElementIds);
      }
    }

    setIsPanning(false);
    setIsDragging(false);
    setIsErasing(false);
    setIsDrawingShape(false);
    setIsBoxSelecting(false);
    setBoxStart(null);
    setBoxEnd(null);
    setDragStart(null);
  }, [isPanning, isDragging, isDrawingShape, isBoxSelecting, tool, drawPoints, shapePreview, shapeType, shapeColor, drawColor, boxStart, boxEnd, elements, addElement, userId, emitElementCreate, setSelectedId, setSelectedIds]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (suppressClickClearRef.current) {
      suppressClickClearRef.current = false;
      return;
    }
    if (e.target === canvasRef.current) {
      clearSelection();
    }
  }, [clearSelection]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0) {
        selectedIds.forEach((id) => {
          emitElementDelete(id);
          deleteElement(id);
        });
        clearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, deleteElement, emitElementDelete, clearSelection]);

  return (
    <div
      ref={canvasRef}
      className={cn(
        'w-full h-full overflow-hidden bg-white relative select-none',
        isPanning ? 'cursor-grabbing' : tool === 'pan' ? 'cursor-grab' : tool === 'eraser' ? 'cursor-cell' : tool === 'select' ? 'cursor-default' : 'cursor-crosshair'
      )}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleCanvasClick}
      style={{
        backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)',
        backgroundSize: `${20 * viewportZoom}px ${20 * viewportZoom}px`,
        backgroundPosition: `${viewportPosition.x}px ${viewportPosition.y}px`,
      }}
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

        {/* Rough Preview Layer */}
        <svg
          ref={previewSvgRef}
          className="absolute inset-0 pointer-events-none overflow-visible"
        />

        {/* Box selection while dragging */}
        {isBoxSelecting && boxStart && boxEnd && (
          <div
            className="absolute border border-blue-500 bg-blue-500/5 pointer-events-none"
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
      <PresenceHeatmap />
      <PresenceZones />
      <TimeTravel />

      <div className="absolute bottom-4 left-4 flex gap-4 items-center bg-white/80 backdrop-blur-sm rounded-lg shadow-sm border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">
        <span>Zoom: {Math.round(viewportZoom * 100)}%</span>
        <div className="w-px h-3 bg-slate-300" />
        <span>{elements.size} Elements</span>
      </div>
    </div>
  );
}

function isPointInElement(x: number, y: number, element: CanvasElement): boolean {
  if (element.type === 'drawing' && element.points && element.points.length > 0) {
    const minX = Math.min(...element.points.map(p => p.x));
    const maxX = Math.max(...element.points.map(p => p.x));
    const minY = Math.min(...element.points.map(p => p.y));
    const maxY = Math.max(...element.points.map(p => p.y));
    const padding = 10;
    return x >= minX - padding && x <= maxX + padding && y >= minY - padding && y <= maxY + padding;
  }

  const { position, size } = element;
  return (
    x >= position.x &&
    x <= position.x + size.width &&
    y >= position.y &&
    y <= position.y + size.height
  );
}

function isElementInBox(element: CanvasElement, box: { left: number; right: number; top: number; bottom: number }): boolean {
  const { position, size } = element;
  const left = position.x;
  const right = position.x + size.width;
  const top = position.y;
  const bottom = position.y + size.height;
  return !(right < box.left || left > box.right || bottom < box.top || top > box.bottom);
}
