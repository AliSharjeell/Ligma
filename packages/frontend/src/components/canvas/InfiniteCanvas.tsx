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
  const [enteringEditId, setEnteringEditId] = useState<string | null>(null);
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
    userRole,
    setSelectedId,
    setSelectedIds,
    clearSelection,
    setViewportPosition,
    setViewportZoom,
    addElement,
    updateElement,
    deleteElement,
    lockElement,
  } = useCanvasStore();

  const { emitCursorMove, emitElementCreate, emitElementUpdate, emitElementDelete, emitElementLock } = useSocket();

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
      const padding = 5;

      if (w > 2 && h > 2) {
        const options = { stroke: shapeColor, strokeWidth: 2, roughness: 1.5 };
        let node;
        if (shapeType === 'circle') {
          node = rc.ellipse(x + w / 2, y + h / 2, w, h, options);
        } else if (shapeType === 'line') {
          node = rc.line(x, y + h / 2, x + w, y + h / 2, options);
        } else if (shapeType === 'triangle') {
          node = rc.polygon([
            [x + w / 2, y],
            [x, y + h],
            [x + w, y + h]
          ], options);
        } else if (shapeType === 'diamond') {
          node = rc.polygon([
            [x + w / 2, y],
            [x + w, y + h / 2],
            [x + w / 2, y + h],
            [x, y + h / 2]
          ], options);
        } else if (shapeType === 'hexagon') {
          const hexPoints = [];
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 2;
            hexPoints.push([
              x + w / 2 + (w / 2) * Math.cos(angle),
              y + h / 2 + (h / 2) * Math.sin(angle)
            ]);
          }
          node = rc.polygon(hexPoints, options);
        } else if (shapeType === 'star') {
          const starPoints = [];
          const outerR = Math.min(w, h) / 2;
          const innerR = outerR * 0.4;
          for (let i = 0; i < 10; i++) {
            const angle = (Math.PI / 5) * i - Math.PI / 2;
            const r = i % 2 === 0 ? outerR : innerR;
            starPoints.push([
              x + w / 2 + r * Math.cos(angle),
              y + h / 2 + r * Math.sin(angle)
            ]);
          }
          node = rc.polygon(starPoints, options);
        } else if (shapeType === 'arrow') {
          const x1 = x + padding;
          const y1 = y + h / 2;
          const x2 = x + w - padding;
          const y2 = y + h / 2;
          node = rc.line(x1, y1, x2, y2, options);
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const headLength = Math.min(w, h) * 0.3;
          const head1X = x2 - headLength * Math.cos(angle - Math.PI / 6);
          const head1Y = y2 - headLength * Math.sin(angle - Math.PI / 6);
          const head2X = x2 - headLength * Math.cos(angle + Math.PI / 6);
          const head2Y = y2 - headLength * Math.sin(angle + Math.PI / 6);
          const head1 = rc.line(x2, y2, head1X, head1Y, options);
          const head2 = rc.line(x2, y2, head2X, head2Y, options);
          previewSvgRef.current.appendChild(node);
          previewSvgRef.current.appendChild(head1);
          previewSvgRef.current.appendChild(head2);
          return;
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

  // Use native listener for wheel to ensure we can preventDefault (React synthetic events are often passive)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      const state = useCanvasStore.getState();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(state.viewportZoom * delta, 0.1), 5);
      state.setViewportZoom(newZoom);
    };

    canvas.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleNativeWheel);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const x = (e.clientX - canvasRect.left - viewportPosition.x) / viewportZoom;
    const y = (e.clientY - canvasRect.top - viewportPosition.y) / viewportZoom;

    // Check if clicking on an element
    const clickedElement = Array.from(elements.values()).find(el => isPointInElement(x, y, el));

    // If clicking on background with select tool
    if (tool === 'select' && !clickedElement) {
      // Start box selection
      setIsBoxSelecting(true);
      setBoxStart({ x, y });
      setBoxEnd({ x, y });
      return;
    }

    // If elements are already selected and clicking on background (for potential multi-drag)
    if (tool === 'select' && !clickedElement && selectedIds.size > 1) {
      // Clear selection if clicking empty area
      clearSelection();
      return;
    }

    // If clicking on an element with select tool
    if (tool === 'select' && clickedElement) {
      // If element is not selected, select it
      if (!selectedIds.has(clickedElement.id)) {
        setSelectedId(clickedElement.id);
      }
      // Start dragging (either single or multiple)
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // Grab/Pan by default for Select and Pan tools
    if (e.button === 1 || (e.button === 0 && (tool === 'pan' || tool === 'select'))) {
      // Only pan if we're not clicking on an element or in select mode
      if (!clickedElement) {
        setIsPanning(true);
        setDragStart({ x: e.clientX - viewportPosition.x, y: e.clientY - viewportPosition.y });
      }
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

    // Create sticky note on click
    if (tool === 'sticky') {
      if (userRole === 'Viewer') {
        alert('You are in Viewer mode. Ask a Lead or Contributor to edit.');
        return;
      }
      const element = addElement({
        type: 'sticky',
        position: { x, y },
        size: { width: 200, height: 150 },
        content: '',
        color: stickyColor,
        locked: false,
        createdBy: userId,
      });
      emitElementCreate(element);
      setSelectedId(element.id);
      return;
    }

    // Create text on click
    if (tool === 'text') {
      if (userRole === 'Viewer') {
        alert('You are in Viewer mode. Ask a Lead or Contributor to edit.');
        return;
      }
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
          textAlign: textAlign || 'left',
        },
        locked: false,
        createdBy: userId,
      });
      emitElementCreate(element);
      setSelectedId(element.id);
      // Auto-enter edit mode
      setTimeout(() => {
        lockElement(element.id);
        emitElementLock(element.id);
      }, 50);
      return;
    }

    // In Excalidraw-like mode, single click on sticky does nothing or just pans if background
    // We keep sticky creation on click for now or move to double? User said "nothing should happen on single click"
    // So let's disable single-click creation for tools
  }, [tool, viewportPosition, viewportZoom, elements, emitElementDelete, deleteElement, stickyColor, userRole, textColor, textFontSize, textFontFamily, textFontWeight, textAlign]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const x = (e.clientX - canvasRect.left - viewportPosition.x) / viewportZoom;
    const y = (e.clientY - canvasRect.top - viewportPosition.y) / viewportZoom;

    emitCursorMove({ x: e.clientX, y: e.clientY });

    if (isPanning && dragStart) {
      const dx = Math.abs(e.clientX - (dragStart.x + viewportPosition.x));
      const dy = Math.abs(e.clientY - (dragStart.y + viewportPosition.y));
      
      if (dx > 3 || dy > 3) {
        suppressClickClearRef.current = true;
      }

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

    // Multi-drag: when dragging selected elements
    if (isDragging && tool === 'select' && selectedIds.size > 0 && dragStart) {
      suppressClickClearRef.current = true;
      const dx = (e.clientX - dragStart.x) / viewportZoom;
      const dy = (e.clientY - dragStart.y) / viewportZoom;

      // Move all selected elements
      selectedIds.forEach(id => {
        const element = elements.get(id);
        if (element) {
          updateElement(id, {
            position: {
              x: element.position.x + dx,
              y: element.position.y + dy,
            },
          });
        }
      });
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
  }, [isPanning, isDragging, isDrawingShape, isErasing, isBoxSelecting, dragStart, tool, viewportPosition, viewportZoom, shapeStart, boxStart, elements, emitCursorMove, setViewportPosition, emitElementDelete, deleteElement, selectedIds, updateElement]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && tool === 'draw' && drawPoints.length > 1) {
      if (userRole === 'Viewer') {
        alert('You are in Viewer mode. Ask a Lead or Contributor to edit.');
        setDrawPoints([]);
        setIsDragging(false);
        return;
      }
      const minX = Math.min(...drawPoints.map(p => p.x));
      const minY = Math.min(...drawPoints.map(p => p.y));
      const maxX = Math.max(...drawPoints.map(p => p.x));
      const maxY = Math.max(...drawPoints.map(p => p.y));
      const element = addElement({
        type: 'drawing',
        position: { x: minX, y: minY },
        size: { width: maxX - minX, height: maxY - minY },
        content: '',
        points: drawPoints,
        color: drawColor,
        locked: false,
        createdBy: userId,
      });
      emitElementCreate(element);
      setSelectedId(element.id);
      setDrawPoints([]);
    }

    if (isDrawingShape && tool === 'shape' && shapePreview) {
      if (userRole === 'Viewer') {
        alert('You are in Viewer mode. Ask a Lead or Contributor to edit.');
        setShapePreview(null);
        setShapeStart(null);
        setIsDrawingShape(false);
        return;
      }
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

    // Sync moved elements to server
    if (isDragging && tool === 'select' && selectedIds.size > 0) {
      selectedIds.forEach(id => {
        const element = elements.get(id);
        if (element) {
          emitElementUpdate(element);
        }
      });
    }

    setIsPanning(false);
    setIsDragging(false);
    setIsErasing(false);
    setIsDrawingShape(false);
    setIsBoxSelecting(false);
    setBoxStart(null);
    setBoxEnd(null);
    setDragStart(null);
  }, [isPanning, isDragging, isDrawingShape, isBoxSelecting, tool, drawPoints, shapePreview, shapeType, shapeColor, drawColor, boxStart, boxEnd, elements, addElement, userId, emitElementCreate, emitElementUpdate, setSelectedId, setSelectedIds]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (suppressClickClearRef.current) {
      suppressClickClearRef.current = false;
      return;
    }
    // Only clear selection if clicking exactly on canvas and not dragging/panning
    if (e.target === canvasRef.current) {
      clearSelection();
    }
  }, [clearSelection]);

  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent) => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const x = (e.clientX - canvasRect.left - viewportPosition.x) / viewportZoom;
    const y = (e.clientY - canvasRect.top - viewportPosition.y) / viewportZoom;

    // Check if double clicked an element
    const elementsArray = Array.from(elements.values());
    const clickedElement = elementsArray.find((element) => isPointInElement(x, y, element));

    if (clickedElement && tool === 'select') {
      setSelectedId(clickedElement.id);
      // If it's text, we can also enter edit mode here if needed
      return;
    }

    // If double clicked background, create text
    if (userRole === 'Viewer') {
      alert('You are in Viewer mode. Ask a Lead or Contributor to edit.');
      return;
    }
    setEnteringEditId(''); // Signal we're creating a text element (empty string = skip border)
    const element = addElement({
      type: 'text',
      position: { x, y: y - 10 },
      size: { width: 10, height: 24 },
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
    setEnteringEditId(element.id); // Signal we've entered edit mode

    setTimeout(() => {
      lockElement(element.id);
      emitElementLock(element.id);
      setEnteringEditId(null); // Clear after transition
    }, 50);
  }, [viewportPosition, viewportZoom, elements, addElement, textColor, textFontSize, textFontFamily, textFontWeight, textAlign, userId, emitElementCreate, setSelectedId, lockElement, emitElementLock, tool]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't delete when typing in an input/textarea (like text editing)
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0) {
        const activeElement = document.activeElement;
        const isEditingText = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
        if (isEditingText) return;

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
        isPanning ? 'cursor-grabbing' : (tool === 'pan' || tool === 'select') ? 'cursor-grab' : tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair'
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleCanvasClick}
      onDoubleClick={handleCanvasDoubleClick}
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
              return <TextBlock key={element.id} element={element} skipSelectionBorder={enteringEditId === element.id} />;
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

        {/* Selection box visual */}
        {isBoxSelecting && boxStart && boxEnd && (
          <div
            className="absolute pointer-events-none border-2 border-blue-500 bg-blue-500/10 z-50"
            style={{
              left: Math.min(boxStart.x, boxEnd.x),
              top: Math.min(boxStart.y, boxEnd.y),
              width: Math.abs(boxEnd.x - boxStart.x),
              height: Math.abs(boxEnd.y - boxStart.y),
            }}
          />
        )}

        {/* Multi-selection indicator */}
        {selectedIds.size > 1 && (
          <div
            className="absolute pointer-events-none border-2 border-blue-500 rounded-sm"
            style={{
              left: -2,
              top: -2,
              right: -2,
              bottom: -2,
              zIndex: 9999,
            }}
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
              {selectedIds.size} selected
            </div>
          </div>
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
