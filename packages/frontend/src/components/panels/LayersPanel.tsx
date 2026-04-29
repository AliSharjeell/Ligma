'use client';

import React from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { useSocket } from '@/contexts/socket-context';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Layers, Trash2, Lock, Unlock, Pencil, Square, StickyNote, Type, Image, MessageCircle, Folder, ChevronRight, ChevronDown, Group, Ungroup } from 'lucide-react';
import type { CanvasElement, ElementType } from '@/types/canvas';

const LAYER_ICONS: Record<ElementType, React.ReactNode> = {
  drawing: <Pencil className="size-3" />,
  shape: <Square className="size-3" />,
  sticky: <StickyNote className="size-3" />,
  text: <Type className="size-3" />,
  image: <Image className="size-3" />,
  comment: <MessageCircle className="size-3" />,
};

interface GroupedLayer {
  groupId: string;
  children: CanvasElement[];
}

export function LayersList() {
  const { elements, selectedIds, setSelectedId, setSelectedIds, deleteElement, lockElement, unlockElement, ungroupElements, userRole, groupElements } = useCanvasStore();
  const { emitElementDelete, emitElementLock, emitElementUnlock, emitElementUpdate, emitBulkLock, emitBulkUnlock } = useSocket();
  const [lastSelectedId, setLastSelectedId] = React.useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(new Set());

  const canEdit = userRole !== 'Viewer';
  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;

  const selectedElements = React.useMemo(() => {
    return Array.from(selectedIds).map(id => elements.get(id)).filter(Boolean) as CanvasElement[];
  }, [selectedIds, elements]);

  const allSelectedLocked = selectedElements.every(el => el.locked);
  const allSelectedUnlocked = selectedElements.every(el => !el.locked);
  const hasMixedLockStates = !allSelectedLocked && !allSelectedUnlocked;

  const handleBulkLock = () => {
    if (!canEdit) return;
    const unlockedIds = selectedElements.filter(el => !el.locked).map(el => el.id);
    if (unlockedIds.length > 0) {
      unlockedIds.forEach(id => lockElement(id));
      emitBulkLock(unlockedIds);
    }
  };

  const handleBulkUnlock = () => {
    if (!canEdit) return;
    const lockedIds = selectedElements.filter(el => el.locked).map(el => el.id);
    if (lockedIds.length > 0) {
      lockedIds.forEach(id => unlockElement(id));
      emitBulkUnlock(lockedIds);
    }
  };

  const handleBulkDelete = () => {
    if (!canEdit) return;
    selectedIds.forEach(id => {
      emitElementDelete(id);
      deleteElement(id);
    });
  };

  const handleBulkGroup = () => {
    if (!canEdit || selectedCount < 2) return;
    const groupId = groupElements(selectedIds);
    if (groupId) {
      const groupedElements = useCanvasStore.getState().elements;
      selectedIds.forEach(id => {
        const el = groupedElements.get(id);
        if (el) emitElementUpdate(el);
      });
    }
  };

  const organizedLayers = React.useMemo(() => {
    const elementsArray = Array.from(elements.values()).reverse();
    const groupMap = new Map<string, GroupedLayer>();
    const ungrouped: CanvasElement[] = [];

    elementsArray.forEach((el) => {
      if (el.groupId) {
        if (!groupMap.has(el.groupId)) {
          groupMap.set(el.groupId, { groupId: el.groupId, children: [] });
        }
        groupMap.get(el.groupId)!.children.push(el);
      } else {
        ungrouped.push(el);
      }
    });

    return { groups: Array.from(groupMap.values()), ungrouped };
  }, [elements]);

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
      const layerIds = organizedLayers.ungrouped.map(l => l.id);
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

  const handleGroupClick = (groupId: string, children: CanvasElement[], e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      const newSelection = new Set(selectedIds);
      children.forEach(c => {
        if (newSelection.has(c.id)) {
          newSelection.delete(c.id);
        } else {
          newSelection.add(c.id);
        }
      });
      setSelectedIds(newSelection);
    } else {
      setSelectedIds(new Set(children.map(c => c.id)));
    }
  };

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  if (elements.size === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Layers className="size-8 mx-auto mb-2 opacity-50" />
        <p>No elements yet</p>
      </div>
    );
  }

  return (
    <>
      {hasSelection && selectedCount > 1 && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/50">
          <span className="text-xs text-muted-foreground font-medium">
            {selectedCount} selected
          </span>
          <div className="flex items-center gap-1">
            {canEdit && (
              <>
                {allSelectedUnlocked || hasMixedLockStates ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleBulkLock}
                    title="Lock all"
                  >
                    <Lock className="size-3" />
                  </Button>
                ) : null}
                {allSelectedLocked || hasMixedLockStates ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleBulkUnlock}
                    title="Unlock all"
                  >
                    <Unlock className="size-3" />
                  </Button>
                ) : null}
                {selectedCount >= 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleBulkGroup}
                    title="Group selected"
                  >
                    <Group className="size-3" />
                  </Button>
                )}
                <div className="w-px h-4 bg-border mx-1" />
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={handleBulkDelete}
              disabled={!canEdit}
              title="Delete all"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        </div>
      )}
      <ScrollArea className="h-[600px]">
      <div className="space-y-1">
        {organizedLayers.groups.map((group) => {
          const isGroupSelected = group.children.some(c => selectedIds.has(c.id));
          const isCollapsed = collapsedGroups.has(group.groupId);
          return (
            <div key={group.groupId} className="space-y-1">
              <div
                className={cn(
                  'flex items-center justify-between gap-2 px-2 py-2 rounded border cursor-pointer transition-colors bg-muted/50',
                  isGroupSelected ? 'border-primary bg-primary/10' : 'border-primary/30'
                )}
                onClick={(e) => handleGroupClick(group.groupId, group.children, e)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGroupCollapse(group.groupId);
                    }}
                    className="p-0.5 hover:bg-muted rounded"
                  >
                    {isCollapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
                  </button>
                  <Folder className="size-3 text-primary" />
                  <span className="text-xs font-medium text-primary">Group ({group.children.length})</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={(e) => {
                      e.stopPropagation();
                      const affectedIds = ungroupElements(group.groupId);
                      const currentElements = useCanvasStore.getState().elements;
                      affectedIds.forEach(id => {
                        const el = currentElements.get(id);
                        if (el) emitElementUpdate(el);
                      });
                    }}
                    title="Ungroup"
                  >
                    <Folder className="size-3 text-muted-foreground" />
                  </Button>
                </div>
              </div>
              {!isCollapsed && group.children.map((element) => {
                const isSelected = selectedIds.has(element.id);
                return (
                  <div
                    key={element.id}
                    className={cn(
                      'flex items-center justify-between gap-2 px-2 py-2 rounded border cursor-pointer transition-colors ml-4',
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
          );
        })}
        {organizedLayers.ungrouped.map((element) => {
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
    </>
  );
}

// Re-export as LayersPanel for backwards compatibility
export { LayersList as LayersPanel };
