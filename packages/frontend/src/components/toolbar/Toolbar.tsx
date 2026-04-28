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
  Layers,
  Settings,
  ChevronLeft,
  ChevronRight,
  Wifi,
  WifiOff,
  LogOut,
  PlusCircle,
  Minus,
  Triangle,
  Diamond,
  Hexagon,
  Star,
} from 'lucide-react';
import type { CanvasElement, Tool, ShapeType } from '@/types/canvas';
import { TaskBoard } from '@/components/panels/TaskBoard';
import { EventLog } from '@/components/panels/EventLog';
import { LayersList } from '@/components/panels/LayersPanel';
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
  { id: 'line', icon: <Minus className="size-4" />, label: 'Line' },
  { id: 'triangle', icon: <Triangle className="size-4" />, label: 'Triangle' },
  { id: 'diamond', icon: <Diamond className="size-4" />, label: 'Diamond' },
  { id: 'hexagon', icon: <Hexagon className="size-4" />, label: 'Hexagon' },
  { id: 'star', icon: <Star className="size-4" />, label: 'Star' },
  { id: 'arrow', icon: <ArrowRight className="size-4" />, label: 'Arrow' },
];

export function Toolbar() {
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [pendingRequests, setPendingRequests] = useState<{ userId: string; userName: string }[]>([]);
  const [hasRequested, setHasRequested] = useState(false);
  const router = useRouter();
  const { connected, socket, emitChangeRole, emitRoleRequest, emitApproveRoleRequest, emitDenyRoleRequest, emitTransferOwnership, connectionStatus } = useSocket();

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
    clearSelection,
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
    userName,
    setUserName,
    userRole,
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

    // Check if name is set, if not, open join modal
    const storedName = localStorage.getItem('ligma-username');
    if (!storedName) {
      setIsJoinModalOpen(true);
    } else {
      setNameInput(storedName);
    }
  }, [normalizedRoom]);

  // B: Listen for role request events
  useEffect(() => {
    if (!socket) return;

    const handleRoleRequest = (payload: { userId: string; userName: string }) => {
      setPendingRequests(prev => [...prev.filter(r => r.userId !== payload.userId), payload]);
    };

    const handleRoleChanged = (payload: { userId: string; newRole: string }) => {
      // Remove from pending requests if their role changed
      setPendingRequests(prev => prev.filter(r => r.userId !== payload.userId));
      // If current user got promoted, update their state
      if (payload.userId === userId && payload.newRole === 'Contributor') {
        setHasRequested(false);
      }
    };

    const handleRoleRequestCleared = (payload: { userId: string; denied?: boolean }) => {
      // Remove the request from pending list when denied
      setPendingRequests(prev => prev.filter(r => r.userId !== payload.userId));
    };

    const handleRoleRequestDenied = (payload: { userId?: string; denied?: boolean }) => {
      // When our request was denied, reset the hasRequested state
      // Only reset if this denial is for the current user
      if (!payload.userId || payload.userId === userId) {
        setHasRequested(false);
        alert('Your Contributor request was denied by the Lead.');
      }
    };

    socket.on('role_request', handleRoleRequest);
    socket.on('role_changed', handleRoleChanged);
    socket.on('role_request_cleared', handleRoleRequestCleared);
    socket.on('role_request_denied', handleRoleRequestDenied);

    return () => {
      socket.off('role_request', handleRoleRequest);
      socket.off('role_changed', handleRoleChanged);
      socket.off('role_request_cleared', handleRoleRequestCleared);
      socket.off('role_request_denied', handleRoleRequestDenied);
    };
  }, [socket, userId]);

  const handleJoinRoom = () => {
    const trimmed = roomInput.trim();
    if (!trimmed) return;
    router.push(`/room/${encodeURIComponent(trimmed)}`);
  };

  const handleUpdateName = () => {
    if (nameInput.trim()) {
      setUserName(nameInput.trim());
      setIsJoinModalOpen(false);
      // Reload to reconnect with new name
      window.location.reload();
    }
  };

  const handleCreateRoom = () => {
    const trimmed = roomInput.trim();
    // If user entered a name and it's not the current one, use it
    if (trimmed && trimmed !== normalizedRoom && trimmed !== 'default') {
      router.push(`/room/${encodeURIComponent(trimmed)}`);
    } else {
      // Otherwise generate a random one
      const generated = `room-${Math.random().toString(36).slice(2, 8)}`;
      router.push(`/room/${generated}`);
    }
  };

  const selectedId = selectedIds.size === 1 ? Array.from(selectedIds)[0] : null;
  const selectedElement = selectedId ? getElement(selectedId) : null;
  const isLockedByMe = selectedElement?.locked && selectedElement.lockedBy === userId;

  const colorSwatches = ['#1f2937', '#ef4444', '#22c55e', '#06b6d4', '#8b5cf6', '#f97316', '#e11d48'];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'v' || e.key === 'V') { setTool('select'); clearSelection(); }
      if (e.key === 'h' || e.key === 'H') { setTool('pan'); clearSelection(); }
      if (e.key === 's' || e.key === 'S') { setTool('sticky'); clearSelection(); }
      if (e.key === 'r' || e.key === 'R') { setTool('shape'); clearSelection(); }
      if (e.key === 't' || e.key === 'T') { setTool('text'); clearSelection(); }
      if (e.key === 'd' || e.key === 'D') { setTool('draw'); clearSelection(); }
      if (e.key === 'e' || e.key === 'E') { setTool('eraser'); clearSelection(); }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool, undo, redo, clearSelection]);

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
      {/* Top Left Layers Button */}
      <div className="absolute top-4 left-4 z-20">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
          className={cn(
            "h-10 w-10 rounded-xl bg-white shadow-excalidraw border border-slate-200",
            isLeftPanelOpen && "bg-slate-50 ring-2 ring-primary/10"
          )}
          title="Layers"
        >
          <Layers className="size-5 text-slate-600" />
        </Button>
      </div>

      {/* Bottom Center Toolbar - COMPACT */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-white rounded-xl shadow-excalidraw border border-slate-200 p-1 px-1.5">
        {tools.map((t) => (
          <Button
            key={t.id}
            variant={tool === t.id ? 'default' : 'ghost'}
            size="icon"
            onClick={() => {
              if (userRole === 'Viewer' && t.id !== 'select' && t.id !== 'pan') {
                alert('Viewers cannot use this tool. Changes will not sync.');
                return;
              }
              setTool(t.id);
            }}
            title={t.label}
            className={cn(
              'h-10 w-10 rounded-xl transition-all',
              tool === t.id ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-slate-100 text-slate-600',
              userRole === 'Viewer' && ['draw', 'sticky', 'shape', 'text', 'eraser'].includes(t.id) && 'opacity-50'
            )}
          >
            {t.icon}
          </Button>
        ))}
      </div>

      {/* Tool Options Bar - shows when draw or shape is selected */}
      {(tool === 'draw' || tool === 'shape') && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-white rounded-full shadow-excalidraw border border-slate-200 py-4 px-3">
          {/* Draw/Shape Color */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {colorSwatches.slice(0, 5).map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    if (tool === 'draw') setDrawColor(color);
                    if (tool === 'shape') setShapeColor(color);
                  }}
                  className={cn(
                    'h-5 w-5 rounded-full border border-slate-200 transition-all hover:scale-110',
                    (tool === 'draw' ? drawColor : shapeColor) === color && 'ring-2 ring-primary ring-offset-1'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Shape type selector */}
          {tool === 'shape' && (
            <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
              {shapes.map((s) => (
                <Button
                  key={s.id}
                  variant={shapeType === s.id ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setShapeType(s.id)}
                  className="h-7 w-7 rounded-lg"
                >
                  {s.icon}
                </Button>
              ))}
            </div>
          )}

          {/* Thickness slider for draw */}
          {tool === 'draw' && (
            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
              <input
                type="range"
                min="1"
                max="10"
                value={2}
                className="w-16 h-1"
              />
            </div>
          )}
        </div>
      )}

      {/* Selection Options Bar - shows when element is selected */}
      {selectedElement && userRole !== 'Viewer' && (
        <div
          className="absolute z-20 flex items-center gap-2 bg-white rounded-full shadow-excalidraw border border-slate-200 py-3 px-4"
          style={{
            left: selectedElement.position.x + selectedElement.size.width / 2,
            top: selectedElement.position.y - 80,
            transform: 'translateX(-50%)',
          }}
        >
          {/* Color Options */}
          <div className="flex items-center gap-1 pr-2 border-r border-slate-200">
            {colorSwatches.map((color) => (
              <button
                key={color}
                onClick={() => {
                  updateElement(selectedId!, { color });
                  const updated = useCanvasStore.getState().getElement(selectedId!);
                  if (updated) emitElementUpdate(updated);
                }}
                className={cn(
                  'h-5 w-5 rounded-full border border-slate-200 transition-all hover:scale-110',
                  selectedElement.color === color && 'ring-2 ring-primary ring-offset-1'
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          {/* Lock/Unlock Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (selectedElement.locked && selectedElement.lockedBy === userId) {
                unlockElement(selectedId!);
                emitElementUnlock(selectedId!);
              } else if (!selectedElement.locked) {
                lockElement(selectedId!);
                emitElementLock(selectedId!);
              }
            }}
            className="h-8 w-8 rounded-full hover:bg-slate-100"
            title={selectedElement.locked ? 'Locked - cannot move' : 'Unlock element'}
          >
            {selectedElement.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </Button>

          {/* Delete Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (selectedId) {
                deleteElement(selectedId);
                emitElementDelete(selectedId);
              }
            }}
            className="h-8 w-8 rounded-full hover:bg-red-100 text-red-500"
            title="Delete element"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Viewer Mode Indicator with Request Button */}
      {userRole === 'Viewer' && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-amber-50 text-amber-700 px-4 py-2 rounded-lg border border-amber-200 text-xs">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="font-medium">Viewer Mode</span>
          </div>
          {!hasRequested && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
              onClick={() => {
                emitRoleRequest('Contributor');
                setHasRequested(true);
                alert('Request sent! Waiting for Lead approval.');
              }}
            >
              Request Edit Access
            </Button>
          )}
          {hasRequested && (
            <span className="text-amber-600 italic">Request pending...</span>
          )}
        </div>
      )}

      {/* Lead: Pending Role Requests */}
      {userRole === 'Lead' && pendingRequests.length > 0 && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg border border-blue-200 text-xs">
          <span className="font-medium">{pendingRequests.length} request(s) pending:</span>
          {pendingRequests.map(req => (
            <div key={req.userId} className="flex items-center gap-1">
              <span>{req.userName}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 px-1 text-xs text-green-600 hover:bg-green-100"
                onClick={() => {
                  console.log('Approve clicked for:', req.userId);
                  emitApproveRoleRequest(req.userId);
                  // Optimistically remove from UI
                  setPendingRequests(prev => prev.filter(r => r.userId !== req.userId));
                }}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 px-1 text-xs text-red-600 hover:bg-red-100"
                onClick={() => {
                  console.log('Deny clicked for:', req.userId);
                  emitDenyRoleRequest(req.userId);
                  // Optimistically remove from UI
                  setPendingRequests(prev => prev.filter(r => r.userId !== req.userId));
                }}
              >
                Deny
              </Button>
            </div>
          ))}
        </div>
      )}

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

      {/* Left Sidebar - Layers */}
      <div className={cn(
        "absolute top-1/2 -translate-y-1/2 left-4 z-20 flex flex-col transition-all duration-300",
        isLeftPanelOpen ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0 pointer-events-none"
      )}>
        <div className="bg-white rounded-xl shadow-excalidraw border border-slate-200 p-4 w-72 h-full flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between shrink-0">
            <h3 className="text-sm font-semibold text-slate-700">Layers</h3>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsLeftPanelOpen(false)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 -mx-4 px-4">
            <div className="flex flex-col gap-5 pb-4">
              <LayersList />
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Right Sidebar - Workspace & Connection */}
      <div className={cn(
        "absolute top-1/2 -translate-y-1/2 right-4 z-20 flex flex-col transition-all duration-300",
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
                  Online Users ({users.size})
                </label>
                <div className="flex flex-col gap-2">
                   {/* Current User */}
                   <div className="flex items-center justify-between bg-slate-50 pl-1 pr-3 py-1.5 rounded-xl border border-slate-100">
                     <div className="flex items-center gap-2">
                       <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs text-white font-bold">
                          ME
                       </div>
                       <div className="flex flex-col">
                         <span className="text-xs font-bold text-slate-700">{userName} (You)</span>
                         <span className={cn(
                           "text-[10px] font-medium",
                           userRole === 'Lead' ? "text-amber-600" : userRole === 'Contributor' ? "text-blue-600" : "text-slate-500"
                         )}>
                           {userRole}
                         </span>
                       </div>
                     </div>
                     <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsJoinModalOpen(true)}>
                       <Settings className="size-3" />
                     </Button>
                   </div>

                   {/* Other Users (exclude current user) */}
                   {Array.from(users.values()).filter(u => u.id !== userId).map((user) => (
                     <div key={user.id} className="flex items-center justify-between bg-white pl-1 pr-3 py-1.5 rounded-xl border border-slate-100 shadow-sm">
                       <div className="flex items-center gap-2">
                         <div 
                           className="w-8 h-8 rounded-full flex items-center justify-center text-xs text-white font-bold"
                           style={{ backgroundColor: user.color }}
                          >
                            {user.name[0].toUpperCase()}
                         </div>
                         <div className="flex flex-col">
                           <span className="text-xs font-medium text-slate-700">{user.name}</span>
                           <span className={cn(
                             "text-[10px] font-medium",
                             user.role === 'Lead' ? "text-amber-600" : user.role === 'Contributor' ? "text-blue-600" : "text-slate-500"
                           )}>
                             {user.role}
                           </span>
                         </div>
                       </div>

                       {/* Lead Controls */}
                       {userRole === 'Lead' && (
                         <div className="flex gap-1">
                           <Button
                             variant="ghost"
                             size="icon"
                             className="h-7 w-7"
                             title={user.role === 'Contributor' ? 'Demote to Viewer' : 'Promote to Contributor'}
                             onClick={() => emitChangeRole(user.id, user.role === 'Contributor' ? 'Viewer' : 'Contributor')}
                            >
                             {user.role === 'Contributor' ? <ArrowRight className="size-3 rotate-90 text-slate-400" /> : <PlusCircle className="size-3 text-blue-500" />}
                           </Button>
                           <Button
                             variant="ghost"
                             size="icon"
                             className="h-7 w-7"
                             title="Transfer Ownership"
                             onClick={() => {
                               if (confirm(`Transfer ownership to ${user.name}? You will become a Contributor.`)) {
                                 emitTransferOwnership(user.id);
                               }
                             }}
                           >
                             <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                             </svg>
                           </Button>
                         </div>
                       )}
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

      {/* Join Modal - Identify User */}
      <Dialog open={isJoinModalOpen} onOpenChange={setIsJoinModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Welcome to LIGMA</DialogTitle>
            <DialogDescription>
              Please enter your name to start collaborating.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="col-span-3"
                placeholder="John Doe"
                onKeyDown={(e) => e.key === 'Enter' && handleUpdateName()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateName}>Start Collaborating</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
