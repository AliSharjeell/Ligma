'use client';

import React from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { useSocket } from '@/contexts/socket-context';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Layers, Trash2 } from 'lucide-react';
import type { CanvasElement, ElementType } from '@/types/canvas';

const LAYER_LABELS: Record<ElementType, string> = {
  drawing: 'Pen',
  shape: 'Shape',
  sticky: 'Sticky',
  text: 'Text',
  image: 'Image',
};

function getLayerLabel(element: CanvasElement, counts: Record<ElementType, number>): string {
  const base = LAYER_LABELS[element.type] || 'Layer';
  counts[element.type] += 1;
  return `${base} ${counts[element.type]}`;
}

export function LayersPanel() {
  const { elements, selectedIds, setSelectedId, deleteElement } = useCanvasStore();
  const { emitElementDelete } = useSocket();

  const layers = Array.from(elements.values()).reverse();
  const counts: Record<ElementType, number> = {
    drawing: 0,
    shape: 0,
    sticky: 0,
    text: 0,
    image: 0,
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Layers className="size-4" />
          Layers
          {layers.length > 0 && (
            <span className="text-xs text-muted-foreground ml-1">
              {layers.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[380px]">
        <SheetHeader>
          <SheetTitle>Layers</SheetTitle>
          <SheetDescription>Track and select canvas elements</SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-150px)] mt-4">
          {layers.length > 0 ? (
            <div className="space-y-1">
              {layers.map((element) => {
                const isSelected = selectedIds.has(element.id);
                return (
                  <div
                    key={element.id}
                    className={cn(
                      'flex items-center justify-between gap-2 px-2 py-2 rounded border',
                      isSelected ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted'
                    )}
                  >
                    <button
                      className="flex-1 text-left text-sm truncate"
                      onClick={() => setSelectedId(element.id)}
                    >
                      {getLayerLabel(element, counts)}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        emitElementDelete(element.id);
                        deleteElement(element.id);
                      }}
                      className="h-7 w-7 text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Layers className="size-8 mx-auto mb-2 opacity-50" />
              <p>No elements yet</p>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
