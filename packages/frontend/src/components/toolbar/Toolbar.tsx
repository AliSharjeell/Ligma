'use client';

import React, { useState } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { useSocket } from '@/contexts/socket-context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  MousePointer2,
  StickyNote,
  Square,
  Circle,
  Type,
  Pencil,
  Hand,
  RectangleHorizontal,
  Lock,
  Unlock,
  Trash2,
  Activity,
  Map,
  History,
} from 'lucide-react';
import type { Tool, ShapeType } from '@/types/canvas';

const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
  { id: 'select', icon: <MousePointer2 className="size-4" />, label: 'Select' },
  { id: 'pan', icon: <Hand className="size-4" />, label: 'Pan' },
  { id: 'sticky', icon: <StickyNote className="size-4" />, label: 'Sticky Note' },
  { id: 'shape', icon: <RectangleHorizontal className="size-4" />, label: 'Shape' },
  { id: 'text', icon: <Type className="size-4" />, label: 'Text' },
  { id: 'draw', icon: <Pencil className="size-4" />, label: 'Draw' },
];

const shapes: { id: ShapeType; icon: React.ReactNode; label: string }[] = [
  { id: 'rectangle', icon: <Square className="size-4" />, label: 'Rectangle' },
  { id: 'circle', icon: <Circle className="size-4" />, label: 'Circle' },
];

export function Toolbar() {
  const { tool, shapeType, selectedId, setTool, setShapeType, deleteElement, lockElement, unlockElement, getElement, userId } = useCanvasStore();
  const { emitElementDelete, emitElementLock, emitElementUnlock } = useSocket();

  // Creative bonus feature toggles
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showZones, setShowZones] = useState(false);
  const [showTimeTravel, setShowTimeTravel] = useState(false);

  const selectedElement = selectedId ? getElement(selectedId) : null;
  const isLocked = selectedElement?.locked && selectedElement.lockedBy !== userId;
  const isEditing = selectedElement?.locked && selectedElement.lockedBy === userId;

  const handleDelete = () => {
    if (selectedId) {
      emitElementDelete(selectedId);
      deleteElement(selectedId);
    }
  };

  const handleLock = () => {
    if (selectedId && selectedElement) {
      if (selectedElement.locked && selectedElement.lockedBy === userId) {
        unlockElement(selectedId);
        emitElementUnlock(selectedId);
      } else if (!selectedElement.locked) {
        lockElement(selectedId);
        emitElementLock(selectedId);
      }
    }
  };

  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
      <div className="bg-white rounded-lg shadow-lg border p-1 flex flex-col gap-1">
        {tools.map((t) => (
          <Button
            key={t.id}
            variant={tool === t.id ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setTool(t.id)}
            title={t.label}
            className={cn(
              'h-9 w-9',
              tool === t.id && 'bg-primary text-primary-foreground'
            )}
          >
            {t.icon}
          </Button>
        ))}
      </div>

      {tool === 'shape' && (
        <div className="bg-white rounded-lg shadow-lg border p-1 flex flex-col gap-1">
          {shapes.map((s) => (
            <Button
              key={s.id}
              variant={shapeType === s.id ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setShapeType(s.id)}
              title={s.label}
              className={cn(
                'h-9 w-9',
                shapeType === s.id && 'bg-primary text-primary-foreground'
              )}
            >
              {s.icon}
            </Button>
          ))}
        </div>
      )}

      {selectedElement && (
        <div className="bg-white rounded-lg shadow-lg border p-1 flex flex-col gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLock}
            title={isEditing ? 'Unlock' : 'Lock'}
            className="h-9 w-9"
          >
            {isEditing || selectedElement.locked ? (
              <Unlock className="size-4 text-green-600" />
            ) : (
              <Lock className="size-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            title="Delete"
            className="h-9 w-9 text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      )}

      {/* Creative Bonus Features */}
      <div className="bg-white rounded-lg shadow-lg border p-1 flex flex-col gap-1">
        <Button
          variant={showHeatmap ? 'default' : 'ghost'}
          size="icon"
          onClick={() => setShowHeatmap(!showHeatmap)}
          title="Toggle Heatmap"
          className={cn(
            'h-9 w-9',
            showHeatmap && 'bg-primary text-primary-foreground'
          )}
        >
          <Activity className="size-4" />
        </Button>
        <Button
          variant={showZones ? 'default' : 'ghost'}
          size="icon"
          onClick={() => setShowZones(!showZones)}
          title="Toggle Zones"
          className={cn(
            'h-9 w-9',
            showZones && 'bg-primary text-primary-foreground'
          )}
        >
          <Map className="size-4" />
        </Button>
        <Button
          variant={showTimeTravel ? 'default' : 'ghost'}
          size="icon"
          onClick={() => setShowTimeTravel(!showTimeTravel)}
          title="Toggle Time Travel"
          className={cn(
            'h-9 w-9',
            showTimeTravel && 'bg-primary text-primary-foreground'
          )}
        >
          <History className="size-4" />
        </Button>
      </div>
    </div>
  );
}