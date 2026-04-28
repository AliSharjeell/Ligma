'use client';

import React from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { useSocket } from '@/contexts/socket-context';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Layers, Trash2, Lock, Unlock, Pencil, Square, StickyNote, Type, Image } from 'lucide-react';
import type { CanvasElement, ElementType } from '@/types/canvas';

const LAYER_ICONS: Record<ElementType, React.ReactNode> = {
  drawing: <Pencil className="size-3" />,
  shape: <Square className="size-3" />,
  sticky: <StickyNote className="size-3" />,
  text: <Type className="size-3" />,
  image: <Image className="size-3" />,
};

export function LayersList() {
  const { elements, selectedIds, setSelectedId, setSelectedIds, deleteElement, lockElement, unlockElement } = useCanvasStore();
  const { emitElementDelete, emitElementLock, emitElementUnlock } = useSocket();
  const [lastSelectedId, setLastSelectedId] = React.useState<string | null>(null);

  const layers = Array.from(elements.values()).reverse();
  const counts: Record<ElementType, number> = {
    drawing: 0,
    shape: 0,
    sticky: 0,
    text: 0,
    image: 0,
  };

  const handleLayerClick = (elementId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (e.ctrlKey || e.metaKey) {
      const newSelection = new Set(selectedIds);
      if (newSelection.has(elementId)) {
        newSelection.delete(elementId);
      } else {
        newSelection.add(elementId);
      }
      setSelectedIds(newSelection);
      setLastSelectedId(elementId);
    } else if (e.shiftKey && lastSelectedId) {
      const layerIds = layers.map(l => l.id);
      const startIdx = layerIds.indexOf(lastSelectedId);
      const endIdx = layerIds.indexOf(elementId);

      if (startIdx !== -1 && endIdx !== -1) {
        const min = Math.min(startIdx, endIdx);
        const max = Math.max(startIdx, endIdx);
        const rangeIds = new Set(layerIds.slice(min, max + 1));
        setSelectedIds(rangeIds);
      }
    } else {
      setSelectedId(elementId);
      setLastSelectedId(elementId);
    }
  };

  if (layers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Layers className="size-8 mx-auto mb-2 opacity-50" />
        <p>No elements yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-1">
        {layers.map((element) => {
          const isSelected = selectedIds.has(element.id);
          return (
            <div
              key={element.id}
              className={cn(
                'flex items-center justify-between gap-2 px-2 py-2 rounded border cursor-pointer transition-colors',
                isSelected ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted'
              )}
              onClick={(e) => handleLayerClick(element.id, e)}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {LAYER_ICONS[element.type]}
                <span className="text-xs text-muted-foreground capitalize shrink-0">
                  {element.type}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (element.locked) {
                      unlockElement(element.id);
                      emitElementUnlock(element.id);
                    } else {
                      lockElement(element.id);
                      emitElementLock(element.id);
                    }
                  }}
                  title={element.locked ? 'Unlock' : 'Lock'}
                >
                  {element.locked ? <Lock className="size-3" /> : <Unlock className="size-3 text-muted-foreground" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    emitElementDelete(element.id);
                    deleteElement(element.id);
                  }}
                  title="Delete"
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
