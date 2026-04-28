'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCanvasStore } from '@/store/canvas-store';
import { useSocket } from '@/contexts/socket-context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  MousePointer2,
  StickyNote,
  Square,
  Circle,
  ArrowRight,
  Type,
  Pencil,
  Hand,
  Lock,
  Unlock,
  Trash2,
  Activity,
  Map,
  History,
  Eraser,
  Undo2,
  Redo2,
  Menu,
  Settings,
  ChevronLeft,
  ChevronRight,
  Wifi,
  WifiOff,
  LogOut,
  PlusCircle,
} from 'lucide-react';
import type { CanvasElement, Tool, ShapeType } from '@/types/canvas';
import { TaskBoard } from '@/components/panels/TaskBoard';
import { EventLog } from '@/components/panels/EventLog';
import { LayersPanel } from '@/components/panels/LayersPanel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
  { id: 'select', icon: <MousePointer2 className="size-4" />, label: 'Select (V)' },
  { id: 'draw', icon: <Pencil className="size-4" />, label: 'Draw (D)' },
  { id: 'pan', icon: <Hand className="size-4" />, label: 'Pan (H)' },
  { id: 'sticky', icon: <StickyNote className="size-4" />, label: 'Sticky Note (S)' },
  { id: 'shape', icon: <Square className="size-4" />, label: 'Shape (R)' },
  { id: 'text', icon: <Type className="size-4" />, label: 'Text (T)' },
  { id: 'eraser', icon: <Eraser className="size-4" />, label: 'Eraser (E)' },
];

const shapes: { id: ShapeType; icon: React.ReactNode; label: string }[] = [
  { id: 'rectangle', icon: <Square className="size-4" />, label: 'Rectangle' },
  { id: 'circle', icon: <Circle className="size-4" />, label: 'Circle' },
  { id: 'arrow', icon: <ArrowRight className="size-4" />, label: 'Arrow' },
];

export function Toolbar() {
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const router = useRouter();
  const { connected } = useSocket();

  const {
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
    presenceHeatmapEnabled,
    presenceZonesEnabled,
    timeTravelEnabled,
    selectedIds,
    setTool,
    setShapeType,
    setDrawColor,
    setShapeColor,
    setStickyColor,
    setTextColor,
    setTextFontSize,
    setTextFontFamily,
    setTextFontWeight,
    setTextAlign,
    setPresenceHeatmapEnabled,
    setPresenceZonesEnabled,
    setTimeTravelEnabled,
    deleteElement,
    lockElement,
    unlockElement,
    updateElement,
    getElement,
    userId,
    undo,
    redo,
    canUndo,
    canRedo,
    users,
  } = useCanvasStore();
  const { emitElementDelete, emitElementLock, emitElementUnlock, emitElementUpdate, emitElementLock: emitLock } = useSocket();

  // Room Management Logic
  const currentRoom = (typeof window !== 'undefined' && window.location.pathname.split('/').pop()) || 'default';
  const normalizedRoom = currentRoom && currentRoom !== 'undefined' ? currentRoom : 'default';
  const [roomInput, setRoomInput] = useState(normalizedRoom);

  useEffect(() => {
    setRoomInput(normalizedRoom);
  }, [normalizedRoom]);

  const handleJoinRoom = () => {
    const trimmed = roomInput.trim();
    if (!trimmed) return;
    router.push(`/room/${encodeURIComponent(trimmed)}`);
  };

  const handleCreateRoom = () => {
    const generated = `room-${Math.random().toString(36).slice(2, 8)}`;
    router.push(`/room/${generated}`);
  };

  const selectedId = selectedIds.size === 1 ? Array.from(selectedIds)[0] : null;
  const selectedElement = selectedId ? getElement(selectedId) : null;
  const isLockedByMe = selectedElement?.locked && selectedElement.lockedBy === userId;

  const colorSwatches = ['#1f2937', '#ef4444', '#22c55e', '#06b6d4', '#8b5cf6', '#f97316', '#e11d48'];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'v' || e.key === 'V') setTool('select');
      if (e.key === 'h' || e.key === 'H') setTool('pan');
      if (e.key === 's' || e.key === 'S') setTool('sticky');
      if (e.key === 'r' || e.key === 'R') setTool('shape');
      if (e.key === 't' || e.key === 'T') setTool('text');
      if (e.key === 'd' || e.key === 'D') setTool('draw');
      if (e.key === 'e' || e.key === 'E') setTool('eraser');

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool, undo, redo]);

  const handleTextStyleChange = (updates: Partial<NonNullable<CanvasElement['textStyle']>>) => {
    if (selectedElement?.type === 'text') {
      updateElement(selectedElement.id, { textStyle: { ...selectedElement.textStyle, ...updates } });
      const updated = useCanvasStore.getState().getElement(selectedElement.id);
      if (updated) emitElementUpdate(updated);
    } else {
      if (updates.fontSize !== undefined) setTextFontSize(updates.fontSize);
      if (updates.fontFamily !== undefined) setTextFontFamily(updates.fontFamily);
      if (updates.fontWeight !== undefined) setTextFontWeight(updates.fontWeight);
      if (updates.textAlign !== undefined) setTextAlign(updates.textAlign);
    }
  };

  const activeTextStyle = selectedElement?.type === 'text'
    ? {
      fontSize: selectedElement.textStyle?.fontSize || 20,
      fontFamily: selectedElement.textStyle?.fontFamily || 'var(--font-handwritten), cursive',
      fontWeight: selectedElement.textStyle?.fontWeight || 'normal',
      textAlign: selectedElement.textStyle?.textAlign || 'left',
    }
    : { fontSize: textFontSize, fontFamily: textFontFamily, fontWeight: textFontWeight, textAlign };

  return (
    <>
      {/* Top Left Menu Button */}
      <div className="absolute top-4 left-4 z-20">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
          className={cn(
            "h-10 w-10 rounded-xl bg-white shadow-excalidraw border border-slate-200",
            isLeftPanelOpen && "bg-slate-50 ring-2 ring-primary/10"
          )}
          title="Properties"
        >
          <Menu className="size-5 text-slate-600" />
        </Button>
      </div>

      {/* Top Floating Toolbar - COMPACT */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-white rounded-xl shadow-excalidraw border border-slate-200 p-1 px-1.5">
        {tools.map((t) => (
          <Button
            key={t.id}
            variant={tool === t.id ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setTool(t.id)}
            title={t.label}
            className={cn(
              'h-8 w-8 rounded-lg transition-all',
              tool === t.id ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-slate-100 text-slate-600'
            )}
          >
            {t.icon}
          </Button>
        ))}
      </div>

      {/* Top Right Settings Button */}
      <div className="absolute top-4 right-4 z-20">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
          className={cn(
            "h-10 w-10 rounded-xl bg-white shadow-excalidraw border border-slate-200",
            isRightPanelOpen && "bg-slate-50 ring-2 ring-primary/10"
          )}
          title="Workspace & Settings"
        >
          <Settings className="size-5 text-slate-600" />
        </Button>
      </div>

      {/* Left Sidebar - Properties */}
      <div className={cn(
        "absolute top-16 left-4 bottom-4 z-20 flex flex-col transition-all duration-300",
        isLeftPanelOpen ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0 pointer-events-none"
      )}>
        <div className="bg-white rounded-xl shadow-excalidraw border border-slate-200 p-4 w-72 h-full flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
                <span className="text-white font-bold text-sm">L</span>
              </div>
              <h3 className="text-sm font-semibold text-slate-700">Properties</h3>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsLeftPanelOpen(false)}>
              <ChevronLeft className="size-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 -mx-4 px-4">
            <div className="flex flex-col gap-5 pb-4">
              {/* Shape Selector */}
              {tool === 'shape' && (
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Shape</label>
                  <div className="flex gap-1">
                    {shapes.map((s) => (
                      <Button
                        key={s.id}
                        variant={shapeType === s.id ? 'default' : 'outline'}
                        size="icon"
                        onClick={() => setShapeType(s.id)}
                        className="h-8 w-8 rounded-lg"
                      >
                        {s.icon}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Color Swatches */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase font-bold text-slate-400">Color</label>
                <div className="grid grid-cols-7 gap-1.5">
                  {colorSwatches.map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        if (selectedElement) {
                          updateElement(selectedElement.id, { color });
                          const updated = useCanvasStore.getState().getElement(selectedElement.id);
                          if (updated) emitElementUpdate(updated);
                        } else {
                          if (tool === 'draw') setDrawColor(color);
                          if (tool === 'shape') setShapeColor(color);
                          if (tool === 'sticky') setStickyColor(color);
                          if (tool === 'text') setTextColor(color);
                        }
                      }}
                      className={cn(
                        'h-6 w-6 rounded-full border border-slate-200 transition-all hover:scale-110',
                        (selectedElement?.color || (tool === 'draw' ? drawColor : tool === 'shape' ? shapeColor : tool === 'sticky' ? stickyColor : textColor)) === color &&
                        'ring-2 ring-slate-400 ring-offset-2'
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Text Settings */}
              {(tool === 'text' || selectedElement?.type === 'text') && (
                <div className="flex flex-col gap-3">
                  <Separator />
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Typography</label>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Size</span>
                        <input
                          type="number"
                          value={activeTextStyle.fontSize}
                          onChange={(e) => handleTextStyleChange({ fontSize: Number(e.target.value) })}
                          className="w-16 h-7 px-2 rounded-lg border border-slate-200 text-xs focus:outline-primary"
                        />
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant={activeTextStyle.fontWeight === 'bold' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 h-8 text-xs rounded-lg"
                          onClick={() => handleTextStyleChange({ fontWeight: activeTextStyle.fontWeight === 'bold' ? 'normal' : 'bold' })}
                        >
                          B
                        </Button>
                        {['left', 'center', 'right'].map((align) => (
                          <Button
                            key={align}
                            variant={activeTextStyle.textAlign === align ? 'default' : 'outline'}
                            size="sm"
                            className="flex-1 h-8 text-xs rounded-lg capitalize"
                            onClick={() => handleTextStyleChange({ textAlign: align as any })}
                          >
                            {align[0]}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Element Actions */}
              {selectedElement && (
                <div className="flex flex-col gap-3">
                  <Separator />
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Actions</label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-9 gap-2 rounded-lg text-xs"
                        onClick={() => {
                          if (isLockedByMe || !selectedElement.locked) {
                            if (selectedElement.locked) unlockElement(selectedId!); else lockElement(selectedId!);
                            if (selectedElement.locked) emitElementUnlock(selectedId!); else emitElementLock(selectedId!);
                          }
                        }}
                      >
                        {selectedElement.locked ? <Unlock className="size-3" /> : <Lock className="size-3" />}
                        {selectedElement.locked ? 'Unlock' : 'Lock'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1 h-9 gap-2 rounded-lg text-xs"
                        onClick={() => {
                          emitElementDelete(selectedId!);
                          deleteElement(selectedId!);
                        }}
                      >
                        <Trash2 className="size-3" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Right Sidebar - Workspace & Connection */}
      <div className={cn(
        "absolute top-16 right-4 bottom-4 z-20 flex flex-col transition-all duration-300",
        isRightPanelOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
      )}>
        <div className="bg-white rounded-xl shadow-excalidraw border border-slate-200 p-4 w-80 h-full flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between shrink-0">
            <h3 className="text-sm font-semibold text-slate-700">Workspace</h3>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsRightPanelOpen(false)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 -mx-4 px-4">
            <div className="flex flex-col gap-5 pb-4">
              {/* Room Management */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase font-bold text-slate-400">Current Room</label>
                <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700 truncate mr-2">
                      {normalizedRoom}
                    </span>
                    <div className={cn(
                      'flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                      connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    )}>
                      {connected ? <Wifi className="size-2.5" /> : <WifiOff className="size-2.5" />}
                      {connected ? 'Live' : 'Offline'}
                    </div>
                  </div>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full h-8 text-xs rounded-lg mt-1">
                        Change Room
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Switch Room</DialogTitle>
                        <DialogDescription>
                          Collaborate in a different workspace.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3 py-2">
                        <div className="space-y-2">
                          <Label htmlFor="roomId">Room ID</Label>
                          <Input
                            id="roomId"
                            value={roomInput}
                            onChange={(e) => setRoomInput(e.target.value)}
                            placeholder="e.g. sprint-planning"
                          />
                        </div>
                      </div>
                      <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={handleCreateRoom} className="gap-2">
                          <PlusCircle className="size-4" />
                          Create New
                        </Button>
                        <Button onClick={handleJoinRoom} className="gap-2">
                          <LogOut className="size-4" />
                          Join Room
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Online Users */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase font-bold text-slate-400">
                  Online Users ({users.size + 1})
                </label>
                <div className="flex flex-wrap gap-2">
                   <div className="flex items-center gap-2 bg-slate-50 pl-1 pr-3 py-1 rounded-full border border-slate-100">
                     <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-[10px] text-white font-bold">
                        ME
                     </div>
                     <span className="text-xs font-medium text-slate-700">You</span>
                   </div>
                   {Array.from(users.values()).map((user) => (
                     <div key={user.id} className="flex items-center gap-2 bg-slate-50 pl-1 pr-3 py-1 rounded-full border border-slate-100">
                       <div 
                         className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold"
                         style={{ backgroundColor: user.color }}
                        >
                          {user.name[0].toUpperCase()}
                       </div>
                       <span className="text-xs font-medium text-slate-700">{user.name}</span>
                     </div>
                   ))}
                </div>
              </div>

              <Separator />

              {/* Panels Section */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase font-bold text-slate-400">Panels</label>
                <div className="grid grid-cols-1 gap-2">
                  <TaskBoard />
                  <EventLog />
                  <LayersPanel />
                </div>
              </div>

              <Separator />

              {/* Controls */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase font-bold text-slate-400">Canvas Controls</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="h-9 gap-2 text-xs rounded-lg" onClick={undo} disabled={!canUndo()}>
                    <Undo2 className="size-4" />
                    Undo
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 gap-2 text-xs rounded-lg" onClick={redo} disabled={!canRedo()}>
                    <Redo2 className="size-4" />
                    Redo
                  </Button>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  {[
                    { id: 'heatmap', label: 'Activity Heatmap', active: presenceHeatmapEnabled, set: setPresenceHeatmapEnabled, icon: <Activity className="size-4" /> },
                    { id: 'zones', label: 'Presence Zones', active: presenceZonesEnabled, set: setPresenceZonesEnabled, icon: <Map className="size-4" /> },
                    { id: 'history', label: 'Time Travel', active: timeTravelEnabled, set: setTimeTravelEnabled, icon: <History className="size-4" /> },
                  ].map((feature) => (
                    <Button
                      key={feature.id}
                      variant={feature.active ? 'default' : 'outline'}
                      size="sm"
                      className="justify-start gap-3 h-10 text-xs rounded-lg px-3"
                      onClick={() => feature.set(!feature.active)}
                    >
                      {feature.icon}
                      {feature.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </>
  );
}
