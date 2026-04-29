'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
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
import { CommentsOverlay } from './CommentsOverlay';
import { MentionNotifications } from './MentionNotifications';
import { cn } from '@/lib/utils';
import { Minus, Plus } from 'lucide-react';
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
  const hasDraggedRef = useRef(false);

  const {
    elements,
    selectedIds,
    tool,
    shapeType,
    drawColor,
    drawSize,
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
    isCommentMode,
    setSelectedId,
    setSelectedIds,
    clearSelection,
    setViewportPosition,
    setViewportZoom,
    addElement,
    updateElement,
    deleteElement,
    lockElement,
    appendSessionSnapshot,
    replayFrameElements,
  } = useCanvasStore();
  const renderedElements = replayFrameElements ?? elements;
  const isReplayActive = replayFrameElements !== null;

  useEffect(() => {
    appendSessionSnapshot(elements);
  }, [appendSessionSnapshot, elements]);

  const { emitCursorMove, emitElementCreate, emitElementUpdate, emitElementDelete, emitElementLock, connectionStatus } = useSocket();
  const connectionStatusLabel = connectionStatus === 'connected' ? 'Synced' : connectionStatus === 'connecting' ? 'Syncing' : 'Offline';
  const updateZoom = (direction: 'in' | 'out') => {
    const step = direction === 'in' ? 1.1 : 0.9;
    setViewportZoom(Math.min(Math.max(viewportZoom * step, 0.1), 5));
  };
  const stopCanvasInteraction = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const gridStyle = useMemo<React.CSSProperties>(() => {
    const baseWorldSize = 120;
    const targetMajorPx = 96;
    const zoomSafe = Math.max(viewportZoom, 0.0001);
    const stepExponent = Math.round(Math.log2(targetMajorPx / (baseWorldSize * zoomSafe)));
    const clampedExponent = Math.max(-8, Math.min(8, stepExponent));
    const majorWorldSize = baseWorldSize * Math.pow(2, clampedExponent);
    const majorStepPx = majorWorldSize * zoomSafe;
    const minorStepPx = majorStepPx / 4;
    const minorOpacity = Math.max(0, Math.min(0.08, (minorStepPx - 6) * 0.003));

    const minorLine = `rgba(148, 163, 184, ${minorOpacity.toFixed(3)})`;
    const majorLine = 'rgba(148, 163, 184, 0.16)';
    const position = `${viewportPosition.x}px ${viewportPosition.y}px`;

    return {
      backgroundImage: `
        linear-gradient(to right, ${minorLine} 1px, transparent 1px),
        linear-gradient(to bottom, ${minorLine} 1px, transparent 1px),
        linear-gradient(to right, ${majorLine} 1px, transparent 1px),
        linear-gradient(to bottom, ${majorLine} 1px, transparent 1px)
      `,
      backgroundSize: `
        ${minorStepPx}px ${minorStepPx}px,
        ${minorStepPx}px ${minorStepPx}px,
        ${majorStepPx}px ${majorStepPx}px,
        ${majorStepPx}px ${majorStepPx}px
      `,
      backgroundPosition: `${position}, ${position}, ${position}, ${position}`,
    };
  }, [viewportPosition.x, viewportPosition.y, viewportZoom]);

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
        const options = { stroke: shapeColor, strokeWidth: 2, roughness: 0 };
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
          const hexPoints: [number, number][] = [];
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 2;
            hexPoints.push([
              x + w / 2 + (w / 2) * Math.cos(angle),
              y + h / 2 + (h / 2) * Math.sin(angle)
            ]);
          }
          node = rc.polygon(hexPoints, options);
        } else if (shapeType === 'star') {
          const starPoints: [number, number][] = [];
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
      const node = rc.curve(points, { stroke: drawColor, strokeWidth: drawSize, roughness: 0 });
      previewSvgRef.current.appendChild(node);
    }
  }, [isDrawingShape, shapePreview, shapeType, shapeColor, isDragging, tool, drawPoints, drawColor, drawSize]);

  // Use native listener for wheel to ensure we can preventDefault (React synthetic events are often passive)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      const canvas = e.currentTarget as HTMLElement;
      const rect = canvas.getBoundingClientRect();
      const state = useCanvasStore.getState();
      const { viewportPosition, viewportZoom } = state;

      // Pan with 2-finger scroll (horizontal or vertical)
      if (e.deltaX !== 0) {
        state.setViewportPosition({
          x: viewportPosition.x - e.deltaX,
          y: viewportPosition.y,
        });
      } else if (e.deltaY !== 0 && !e.ctrlKey) {
        state.setViewportPosition({
          x: viewportPosition.x,
          y: viewportPosition.y - e.deltaY,
        });
      }

      // Zoom toward cursor (like Excalidraw)
      if (e.ctrlKey) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.min(Math.max(viewportZoom * delta, 0.1), 5);

        // Where is the mouse in world coordinates?
        const worldX = (mouseX - viewportPosition.x) / viewportZoom;
        const worldY = (mouseY - viewportPosition.y) / viewportZoom;

        // New viewport position so world point stays under mouse
        const newX = mouseX - worldX * newZoom;
        const newY = mouseY - worldY * newZoom;

        state.setViewportZoom(newZoom);
        state.setViewportPosition({ x: newX, y: newY });
      }
    };

    canvas.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleNativeWheel);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isReplayActive) return;

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const x = (e.clientX - canvasRect.left - viewportPosition.x) / viewportZoom;
    const y = (e.clientY - canvasRect.top - viewportPosition.y) / viewportZoom;

    // Check if clicking on an element
    const allElements = useCanvasStore.getState().elements;
    const clickedElement = Array.from(allElements.values()).reverse().find(el => isPointInElement(x, y, el));

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
      const state = useCanvasStore.getState();
      const currentElements = state.elements;
      const currentSelectedIds = state.selectedIds;

      console.log('Clicked element:', clickedElement.id, 'groupId:', clickedElement.groupId);
      console.log('Current selected:', Array.from(currentSelectedIds));

      let idsToSelect = new Set<string>();
      if (e.shiftKey) {
        idsToSelect = new Set(currentSelectedIds);
        if (clickedElement.groupId) {
           const isGroupSelected = currentSelectedIds.has(clickedElement.id);
           currentElements.forEach((el, id) => {
             if (el.groupId === clickedElement.groupId) {
               if (isGroupSelected) idsToSelect.delete(id);
               else idsToSelect.add(id);
             }
           });
        } else {
           if (currentSelectedIds.has(clickedElement.id)) idsToSelect.delete(clickedElement.id);
           else idsToSelect.add(clickedElement.id);
        }
      } else {
        if (currentSelectedIds.has(clickedElement.id)) {
           idsToSelect = new Set(currentSelectedIds);
        } else {
           if (clickedElement.groupId) {
             currentElements.forEach((el, id) => {
               if (el.groupId === clickedElement.groupId) idsToSelect.add(id);
             });
           } else {
             idsToSelect.add(clickedElement.id);
           }
        }
      }

      console.log('Selecting:', Array.from(idsToSelect));
      setSelectedIds(idsToSelect);

      // Viewers can select but not move elements.
      if (userRole !== 'Viewer') {
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        hasDraggedRef.current = false;
      }
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

    // For all other tools, ignore elements underneath and work directly
    if (tool === 'eraser') {
      setIsErasing(true);
      // Only delete if clicking on element
      if (clickedElement) {
        emitElementDelete(clickedElement.id);
        deleteElement(clickedElement.id);
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

    // Create sticky note on click (if not clicking an existing element)
    if (tool === 'sticky' && !clickedElement) {
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
        locked: true,
        lockedBy: userId,
        createdBy: userId,
      });
      emitElementCreate(element);
      emitElementLock(element.id);
      setSelectedId(element.id);
      return;
    }

    // Create text on click (if not clicking an existing element)
    if (tool === 'text' && !clickedElement) {
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
        locked: true,
        lockedBy: userId,
        createdBy: userId,
      });
      emitElementCreate(element);
      emitElementLock(element.id);
      setSelectedId(element.id);
      return;
    }

    // In Excalidraw-like mode, single click on sticky does nothing or just pans if background
    // We keep sticky creation on click for now or move to double? User said "nothing should happen on single click"
    // So let's disable single-click creation for tools
  }, [isReplayActive, tool, viewportPosition, viewportZoom, elements, emitElementDelete, deleteElement, stickyColor, userRole, textColor, textFontSize, textFontFamily, textFontWeight, textAlign]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isReplayActive) return;

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
    if (isDragging && tool === 'select' && userRole !== 'Viewer' && selectedIds.size > 0 && dragStart) {
      suppressClickClearRef.current = true;
      const currentElements = useCanvasStore.getState().elements;
      const currentSelectedIds = useCanvasStore.getState().selectedIds;
      const dx = (e.clientX - dragStart.x) / viewportZoom;
      const dy = (e.clientY - dragStart.y) / viewportZoom;

      // Get all elements that need to move (selected + their group members)
      const elementsToMove = new Set<string>();
      currentSelectedIds.forEach(id => {
        elementsToMove.add(id);
        const el = currentElements.get(id);
        if (el?.groupId) {
          currentElements.forEach((e, eid) => {
            if (e.groupId === el.groupId) elementsToMove.add(eid);
          });
        }
      });

      if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
        hasDraggedRef.current = true;
      }

      const updates: Record<string, Partial<CanvasElement>> = {};
      // Move all elements (skip locked ones)
      elementsToMove.forEach(id => {
        const element = currentElements.get(id);
        if (element && !element.locked) {
          updates[id] = {
            position: {
              x: element.position.x + dx,
              y: element.position.y + dy,
            },
            ...(element.type === 'drawing' && element.points
              ? { points: element.points.map(p => ({ x: p.x + dx, y: p.y + dy })) }
              : {})
          };
        }
      });

      if (Object.keys(updates).length > 0) {
        useCanvasStore.getState().updateElements(updates, true); // skipHistory = true during drag
      }

      // Reset dragStart so delta doesn't accumulate
      setDragStart({ x: e.clientX, y: e.clientY });
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
  }, [isReplayActive, isPanning, isDragging, isDrawingShape, isErasing, isBoxSelecting, dragStart, tool, viewportPosition, viewportZoom, shapeStart, boxStart, elements, emitCursorMove, setViewportPosition, emitElementDelete, deleteElement, selectedIds, updateElement]);

  const handleMouseUp = useCallback(() => {
    if (isReplayActive) return;

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
        strokeWidth: drawSize,
        locked: false,
        createdBy: userId,
      });
      emitElementCreate(element);
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
      } else {
        clearSelection();
      }
    }

    // Sync moved elements to server (skip locked ones)
    if (isDragging && tool === 'select' && userRole !== 'Viewer' && selectedIds.size > 0 && hasDraggedRef.current) {
      // Get all elements that were moved (selected + their group members)
      const elementsMoved = new Set<string>();
      selectedIds.forEach(id => {
        elementsMoved.add(id);
        const el = elements.get(id);
        if (el?.groupId) {
          elements.forEach((e, eid) => {
            if (e.groupId === el.groupId) elementsMoved.add(eid);
          });
        }
      });

      elementsMoved.forEach(id => {
        const element = elements.get(id);
        if (element && !element.locked) {
          emitElementUpdate(element);
        }
      });

      // Save history after multi-drag finishes
      useCanvasStore.setState(state => {
        const newHistory = [...state.history, { elements: new Map(state.elements), timestamp: Date.now() }].slice(-50);
        return { history: newHistory, redoStack: [] };
      });
      hasDraggedRef.current = false;
    }

    setIsPanning(false);
    setIsDragging(false);
    setIsErasing(false);
    setIsDrawingShape(false);
    setIsBoxSelecting(false);
    setBoxStart(null);
    setBoxEnd(null);
    setDragStart(null);
  }, [isReplayActive, isPanning, isDragging, isDrawingShape, isBoxSelecting, tool, drawPoints, shapePreview, shapeType, shapeColor, drawColor, boxStart, boxEnd, elements, addElement, userId, emitElementCreate, emitElementUpdate, setSelectedId, setSelectedIds, clearSelection]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (isReplayActive) return;

    if (suppressClickClearRef.current) {
      suppressClickClearRef.current = false;
      return;
    }

    // Handle comment mode - set pending comment
    if (isCommentMode || tool === 'comment') {
      clearSelection();
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;

      const screenX = e.clientX - canvasRect.left;
      const screenY = e.clientY - canvasRect.top;
      const canvasX = (screenX - viewportPosition.x) / viewportZoom;
      const canvasY = (screenY - viewportPosition.y) / viewportZoom;

      // Trigger pending comment in CommentsOverlay via store state
      useCanvasStore.setState({
        pendingCommentX: canvasX,
        pendingCommentY: canvasY,
        isCommentMode: false,
        tool: 'select'
      });
      return;
    }

    // Only clear selection if clicking exactly on canvas and not dragging/panning
    if (e.target === canvasRef.current) {
      clearSelection();
    }
  }, [isReplayActive, clearSelection, isCommentMode, tool, viewportPosition, viewportZoom]);

  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent) => {
    if (isReplayActive) return;

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const x = (e.clientX - canvasRect.left - viewportPosition.x) / viewportZoom;
    const y = (e.clientY - canvasRect.top - viewportPosition.y) / viewportZoom;

    // Check if double clicked an element
    const elementsArray = Array.from(renderedElements.values());
    const clickedElement = elementsArray.reverse().find((element) => isPointInElement(x, y, element));

    if (clickedElement && tool === 'select') {
      setSelectedId(clickedElement.id);
      // If it's text, we can also enter edit mode here if needed
      return;
    }

    // Only text tool should create text on double click.
    if (tool !== 'text') {
      return;
    }

    if (userRole === 'Viewer') {
      alert('You are in Viewer mode. Ask a Lead or Contributor to edit.');
      return;
    }

    // Text tool already creates text on single click in handleMouseDown
    // Double click only for other purposes (element selection)
  }, [viewportPosition, viewportZoom, elements, setSelectedId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isReplayActive) return;

      if (e.ctrlKey && e.key === 'g' && !e.shiftKey && selectedIds.size >= 2) {
        e.preventDefault();
        const groupId = useCanvasStore.getState().groupElements(selectedIds);
        if (groupId) {
          const currentElements = useCanvasStore.getState().elements;
          selectedIds.forEach((id) => {
            const el = currentElements.get(id);
            if (el) emitElementUpdate(el);
          });
          clearSelection();
        }
      }
      if (e.ctrlKey && e.key === 'G' && selectedIds.size > 0) {
        e.preventDefault();
        const element = elements.get(Array.from(selectedIds)[0]);
        if (element?.groupId) {
          const affectedIds = useCanvasStore.getState().ungroupElements(element.groupId);
          const currentElements = useCanvasStore.getState().elements;
          affectedIds.forEach((id) => {
            const el = currentElements.get(id);
            if (el) emitElementUpdate(el);
          });
          clearSelection();
        }
      }

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
  }, [isReplayActive, selectedIds, deleteElement, emitElementDelete, clearSelection, elements]);

  return (
    <div
      ref={canvasRef}
      data-canvas="true"
      className={cn(
        'w-full h-full overflow-hidden bg-white relative select-none',
        isPanning ? 'cursor-grabbing' : tool === 'pan' ? 'cursor-grab' : tool === 'select' ? 'cursor-custom-select' : tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair'
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleCanvasClick}
      onDoubleClick={handleCanvasDoubleClick}
    >
      <div className="absolute inset-0 pointer-events-none" style={gridStyle} />

      <div
        className="absolute inset-0 origin-top-left"
        style={{
          transform: `translate(${viewportPosition.x}px, ${viewportPosition.y}px) scale(${viewportZoom})`,
        }}
      >
        {Array.from(renderedElements.values()).map((element) => {
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
        {selectedIds.size > 1 && (() => {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          selectedIds.forEach(id => {
             const el = renderedElements.get(id);
             if (el) {
               if (el.type === 'drawing' && el.points && el.points.length > 0) {
                 const pMinX = Math.min(...el.points.map(p => p.x));
                 const pMaxX = Math.max(...el.points.map(p => p.x));
                 const pMinY = Math.min(...el.points.map(p => p.y));
                 const pMaxY = Math.max(...el.points.map(p => p.y));
                 minX = Math.min(minX, pMinX);
                 minY = Math.min(minY, pMinY);
                 maxX = Math.max(maxX, pMaxX);
                 maxY = Math.max(maxY, pMaxY);
               } else {
                 minX = Math.min(minX, el.position.x);
                 minY = Math.min(minY, el.position.y);
                 maxX = Math.max(maxX, el.position.x + el.size.width);
                 maxY = Math.max(maxY, el.position.y + el.size.height);
               }
             }
          });
          if (minX === Infinity) return null;
          return (
            <div
              className="absolute pointer-events-none border-2 border-blue-500 rounded-sm"
              style={{
                left: minX - 4,
                top: minY - 4,
                width: maxX - minX + 8,
                height: maxY - minY + 8,
                zIndex: 9999,
              }}
            >
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                {selectedIds.size} selected
              </div>
            </div>
          );
        })()}
      </div>

      <CursorPresence />
      <PresenceHeatmap />
      <PresenceZones />
      <TimeTravel />
      <CommentsOverlay />
      <MentionNotifications />

      <div
        className="absolute bottom-4 left-4 flex gap-4 items-center bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 cursor-default"
        onMouseDown={stopCanvasInteraction}
        onMouseUp={stopCanvasInteraction}
        onClick={stopCanvasInteraction}
        onDoubleClick={stopCanvasInteraction}
        onWheelCapture={stopCanvasInteraction}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => updateZoom('out')}
            className="h-8 w-8 rounded-md border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center"
            title="Zoom out"
          >
            <Minus className="size-4" />
          </button>
          <span className="min-w-14 text-center">{Math.round(viewportZoom * 100)}%</span>
          <button
            type="button"
            onClick={() => updateZoom('in')}
            className="h-8 w-8 rounded-md border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center"
            title="Zoom in"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <div className="w-px h-3 bg-slate-300" />
        <span>{renderedElements.size} Elements</span>
        <div className="w-px h-3 bg-slate-300" />
        <div className="relative flex items-center rounded-full p-1 group cursor-default">
          <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-md opacity-0 transition-opacity group-hover:opacity-100">
            {connectionStatusLabel}
          </div>
          <div className={cn(
            "w-3 h-3 rounded-full",
            connectionStatus === 'connected' ? 'bg-green-500' : connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
          )} />
        </div>
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
  // Use minimum hitbox size for text elements (they often have tiny initial sizes)
  const minWidth = element.type === 'text' ? Math.max(size.width, 100) : size.width;
  const minHeight = element.type === 'text' ? Math.max(size.height, 24) : size.height;
  return (
    x >= position.x &&
    x <= position.x + minWidth &&
    y >= position.y &&
    y <= position.y + minHeight
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
