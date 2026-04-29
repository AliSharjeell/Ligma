'use client';

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import html2canvas from 'html2canvas';
import { useCanvasStore } from '@/store/canvas-store';
import { useSocket } from '@/contexts/socket-context';
import { Button } from '@/components/ui/button';
import { cn, generateRoomCode } from '@/lib/utils';
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
  CheckSquare,
  MessageCircle,
  Share2,
  Sparkles,
  CheckCircle2,
  ListTodo,
  HelpCircle,
} from 'lucide-react';
import type { CanvasElement, Tool, ShapeType } from '@/types/canvas';
import { TasksPanel } from '@/components/panels/TaskBoard';
import { ActivityPanel } from '@/components/panels/EventLog';
import { LayersList } from '@/components/panels/LayersPanel';
import { CommentsPanel } from '@/components/panels/CommentsPanel';
import { ChatPanel } from '@/components/panels/ChatPanel';
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
import { Download, FileJson, FileText, Image } from 'lucide-react';

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
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [hasCopiedLink, setHasCopiedLink] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [pendingRequests, setPendingRequests] = useState<{ userId: string; userName: string }[]>([]);
  const [hasRequested, setHasRequested] = useState(false);
  const [rightPanelView, setRightPanelView] = useState<'main' | 'tasks' | 'activity' | 'comments'>('main');
  const [newTaskCount, setNewTaskCount] = useState(0);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const { connected, socket, emitChangeRole, emitRoleRequest, emitApproveRoleRequest, emitDenyRoleRequest, emitTransferOwnership, emitGenerateSummary, connectionStatus } = useSocket();

  const {
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
    presenceHeatmapEnabled,
    presenceZonesEnabled,
    timeTravelEnabled,
    isCommentMode,
    selectedIds,
    elements,
    viewportPosition,
    viewportZoom,
    tasks,
    setTool,
    setShapeType,
    clearSelection,
    setDrawColor,
    setDrawSize,
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
    setIsCommentMode,
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
  const { emitElementDelete, emitElementLock, emitElementUnlock, emitElementUpdate, emitElementLock: emitLock, emitCanvasScreenshot } = useSocket();

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
    socket.on('task_created', () => {
      // Only increment badge if not currently viewing tasks panel
      if (rightPanelView !== 'tasks') {
        setNewTaskCount(prev => prev + 1);
      }
    });

    socket.on('summary_result', ({ summary }: { summary: any }) => {
      setSummaryData(summary);
      setIsGeneratingSummary(false);
      setIsSummaryDialogOpen(true);
    });

    socket.on('summary_error', ({ message }: { message: string }) => {
      console.error('Summary error:', message);
      setIsGeneratingSummary(false);
      alert('Failed to generate summary: ' + message);
    });

    return () => {
      socket.off('role_request', handleRoleRequest);
      socket.off('role_changed', handleRoleChanged);
      socket.off('role_request_cleared', handleRoleRequestCleared);
      socket.off('role_request_denied', handleRoleRequestDenied);
      socket.off('task_created');
      socket.off('summary_result');
      socket.off('summary_error');
    };
  }, [socket, userId, rightPanelView]);

  // Reset new task count when viewing tasks panel
  useEffect(() => {
    if (rightPanelView === 'tasks') {
      setNewTaskCount(0);
    }
  }, [rightPanelView]);

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
      const generated = generateRoomCode();
      router.push(`/room/${encodeURIComponent(generated)}`);
    }
  };

  const boardShareLink = typeof window !== 'undefined' ? window.location.href : '';

  const handleCopyBoardLink = async () => {
    if (!boardShareLink) return;
    try {
      await navigator.clipboard.writeText(boardShareLink);
      setHasCopiedLink(true);
      window.setTimeout(() => setHasCopiedLink(false), 1800);
    } catch {
      alert('Could not copy automatically. Please copy the link manually.');
    }
  };

  const selectedId = selectedIds.size === 1 ? Array.from(selectedIds)[0] : null;
  const selectedElement = selectedId ? getElement(selectedId) : null;
  const selectionToolbarPosition = useMemo(() => {
    if (!selectedElement) return null;

    const margin = 16;
    const toolbarWidth = 360;
    const toolbarHeight = 56;
    const elementCenterX = selectedElement.position.x + selectedElement.size.width / 2;
    const elementTopY = selectedElement.position.y;
    const elementBottomY = selectedElement.position.y + selectedElement.size.height;

    const centerX = viewportPosition.x + elementCenterX * viewportZoom;
    const topY = viewportPosition.y + elementTopY * viewportZoom;
    const bottomY = viewportPosition.y + elementBottomY * viewportZoom;

    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const minLeft = margin + toolbarWidth / 2;
    const maxLeft = viewportWidth - margin - toolbarWidth / 2;

    const left = Math.min(Math.max(centerX, minLeft), maxLeft);
    let top = topY - 68;
    if (top < margin) top = bottomY + 14;
    const maxTop = viewportHeight - margin - toolbarHeight;
    top = Math.min(Math.max(top, margin), maxTop);

    return { left, top };
  }, [selectedElement, viewportPosition.x, viewportPosition.y, viewportZoom]);
  const isLockedByMe = selectedElement?.locked && selectedElement.lockedBy === userId;

  // Function to capture canvas screenshot
  const captureCanvasScreenshot = useCallback(async () => {
    // Find the canvas element
    const canvasElement = document.querySelector('[class*="w-full h-full overflow-hidden bg-white"]') as HTMLElement;
    if (!canvasElement) {
      console.log('Canvas element not found');
      return null;
    }

    try {
      const canvas = await html2canvas(canvasElement, {
        backgroundColor: '#ffffff',
        scale: 1,
        useCORS: true,
        logging: false,
      });

      // Convert to base64 JPEG for efficiency
      const screenshot = canvas.toDataURL('image/jpeg', 0.8);
      return screenshot;
    } catch (error) {
      console.error('Failed to capture canvas screenshot:', error);
      return null;
    }
  }, []);

  // Update the generate summary handler to include screenshot
  const handleGenerateSummary = useCallback(async () => {
    setIsGeneratingSummary(true);

    // Capture screenshot first
    const screenshot = await captureCanvasScreenshot();

    // Send screenshot to backend if captured
    if (screenshot) {
      emitCanvasScreenshot(screenshot);
    }

    // Emit generate summary event
    emitGenerateSummary();
  }, [captureCanvasScreenshot, emitCanvasScreenshot, emitGenerateSummary]);

  const colorSwatches = ['#1f2937', '#ef4444', '#22c55e', '#06b6d4', '#8b5cf6', '#f97316', '#e11d48'];

  // Export handlers
  const handleExportPNG = useCallback(async () => {
    const canvasElement = document.querySelector('[class*="w-full h-full overflow-hidden bg-white"]') as HTMLElement;
    if (!canvasElement) return;

    try {
      const canvas = await html2canvas(canvasElement, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        useCORS: true,
        logging: false,
      });

      const link = document.createElement('a');
      link.download = `ligma-canvas-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to export PNG:', error);
    }
  }, []);

  const handleExportJSON = useCallback(() => {
    const elementsArray = Array.from(elements.values());

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      viewport: {
        position: viewportPosition,
        zoom: viewportZoom,
      },
      elements: elementsArray,
      stats: {
        stickyNotes: elementsArray.filter(e => e.type === 'sticky').length,
        textBlocks: elementsArray.filter(e => e.type === 'text').length,
        shapes: elementsArray.filter(e => e.type === 'shape').length,
        drawings: elementsArray.filter(e => e.type === 'drawing').length,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ligma-canvas-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [elements, viewportPosition, viewportZoom]);

  const handleExportMarkdown = useCallback(() => {
    const elementsArray = Array.from(elements.values());
    const stickyNotes = elementsArray.filter(e => e.type === 'sticky' && e.content);
    const textBlocks = elementsArray.filter(e => e.type === 'text' && e.content);
    const shapes = elementsArray.filter(e => e.type === 'shape');
    const drawings = elementsArray.filter(e => e.type === 'drawing');

    let md = `# Ligma Canvas Export\n\n`;
    md += `*Exported on ${new Date().toLocaleString()}*\n\n`;

    if (stickyNotes.length > 0) {
      md += `## Sticky Notes (${stickyNotes.length})\n\n`;
      stickyNotes.forEach((note, i) => {
        const color = note.color || '#fef08a';
        md += `### Note ${i + 1}\n`;
        md += `- **Color:** ${color}\n`;
        md += `- **Position:** (${Math.round(note.position.x)}, ${Math.round(note.position.y)})\n`;
        md += `- **Content:** ${note.content}\n\n`;
      });
    }

    if (textBlocks.length > 0) {
      md += `## Text Blocks (${textBlocks.length})\n\n`;
      textBlocks.forEach((text, i) => {
        md += `### Text ${i + 1}\n`;
        md += `- **Position:** (${Math.round(text.position.x)}, ${Math.round(text.position.y)})\n`;
        md += `- **Content:** ${text.content}\n`;
        if (text.textStyle?.fontSize) {
          md += `- **Font Size:** ${text.textStyle.fontSize}px\n`;
        }
        md += '\n';
      });
    }

    if (shapes.length > 0) {
      md += `## Shapes (${shapes.length})\n\n`;
      const shapeCounts = shapes.reduce((acc, s) => {
        const type = s.shapeType || 'rectangle';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      md += `Shape summary: ${Object.entries(shapeCounts).map(([type, count]) => `${count}x ${type}`).join(', ')}\n\n`;
    }

    if (drawings.length > 0) {
      md += `## Freehand Drawings (${drawings.length})\n\n`;
      md += `Canvas contains ${drawings.length} freehand drawing(s)\n\n`;
    }

    // Tasks summary
    if (tasks.length > 0) {
      md += `## Tasks (${tasks.length})\n\n`;
      tasks.forEach(task => {
        md += `- [${task.status === 'completed' ? 'x' : ' '}] ${task.title}\n`;
        if (task.description) md += `  - ${task.description}\n`;
      });
      md += '\n';
    }

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ligma-canvas-${new Date().toISOString().split('T')[0]}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }, [elements, tasks]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLElement && e.target.isContentEditable) return;

      const setToolFromShortcut = (nextTool: Tool) => {
        if (userRole === 'Viewer' && nextTool !== 'select' && nextTool !== 'pan' && nextTool !== 'comment') {
          alert('Viewers can only use Select, Pan and Comment tools.');
          return;
        }
        setIsCommentMode(nextTool === 'comment');
        setTool(nextTool);
        clearSelection();
      };

      switch (e.key.toLowerCase()) {
        case 'v':
          setToolFromShortcut('select');
          break;
        case 'h':
          setToolFromShortcut('pan');
          break;
        case 's':
          setToolFromShortcut('sticky');
          break;
        case 'r':
          setToolFromShortcut('shape');
          break;
        case 't':
          setToolFromShortcut('text');
          break;
        case 'd':
          setToolFromShortcut('draw');
          break;
        case 'e':
          setToolFromShortcut('eraser');
          break;
        case 'c':
          setToolFromShortcut(useCanvasStore.getState().isCommentMode ? 'select' : 'comment');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool, undo, redo, clearSelection, userRole, setIsCommentMode]);

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
      {/* Top Left Branding + Export */}
      <div className="absolute top-4 left-4 z-20">
        <div className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 shadow-excalidraw px-3 py-2">
          <h1
            className="text-2xl font-bold tracking-tight text-primary leading-none select-none"
            style={{ fontFamily: 'var(--font-lora), serif' }}
          >
            Ligma
          </h1>
          <Dialog open={isShareModalOpen} onOpenChange={setIsShareModalOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg text-slate-600 hover:bg-slate-100"
                title="Export board link"
              >
                <Share2 className="size-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[460px]">
              <DialogHeader>
                <DialogTitle>Export Board Link</DialogTitle>
                <DialogDescription>
                  Copy this board link to share it with your team.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Label htmlFor="board-link">Board Link</Label>
                <Input id="board-link" value={boardShareLink} readOnly />
              </div>
              <DialogFooter>
                <Button onClick={handleCopyBoardLink}>
                  {hasCopiedLink ? 'Copied' : 'Copy Link'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg text-slate-600 hover:bg-slate-100"
                title="Export canvas"
              >
                <Download className="size-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Download className="size-5" />
                  Export Canvas
                </DialogTitle>
                <DialogDescription>
                  Download your canvas in different formats.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-4">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-14"
                  onClick={() => {
                    handleExportPNG();
                    setIsExportModalOpen(false);
                  }}
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Image className="size-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Export as PNG</div>
                    <div className="text-xs text-muted-foreground">High-quality image of your canvas</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-14"
                  onClick={() => {
                    handleExportJSON();
                    setIsExportModalOpen(false);
                  }}
                >
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <FileJson className="size-5 text-green-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Export as JSON</div>
                    <div className="text-xs text-muted-foreground">Full canvas data with all elements</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-14"
                  onClick={() => {
                    handleExportMarkdown();
                    setIsExportModalOpen(false);
                  }}
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <FileText className="size-5 text-purple-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Export as Markdown</div>
                    <div className="text-xs text-muted-foreground">Formatted document with content</div>
                  </div>
                </Button>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsExportModalOpen(false)}>Cancel</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Middle Left Layers Button */}
      <div className="absolute top-1/2 -translate-y-1/2 left-4 z-20">
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
        <Button
          variant={isCommentMode ? 'default' : 'ghost'}
          size="icon"
          onClick={() => {
            if (isCommentMode) {
              setIsCommentMode(false);
              setTool('select');
            } else {
              setIsCommentMode(true);
              setTool('comment');
              clearSelection();
            }
          }}
          title="Comment (C)"
          className={cn(
            'h-10 w-10 rounded-xl transition-all',
            isCommentMode ? 'bg-blue-500 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-600'
          )}
        >
          <MessageCircle className="size-4" />
        </Button>
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <Button
          variant="ghost"
          size="icon"
          onClick={undo}
          disabled={!canUndo()}
          title="Undo (Ctrl+Z)"
          className="h-10 w-10 rounded-xl hover:bg-slate-100 text-slate-600 disabled:opacity-30"
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={redo}
          disabled={!canRedo()}
          title="Redo (Ctrl+Shift+Z)"
          className="h-10 w-10 rounded-xl hover:bg-slate-100 text-slate-600 disabled:opacity-30"
        >
          <Redo2 className="size-4" />
        </Button>
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
                max="20"
                value={drawSize}
                onChange={(e) => setDrawSize(Number(e.target.value))}
                className="w-20 h-1 accent-primary"
                title={`Size: ${drawSize}px`}
              />
              <span className="text-xs text-slate-500 w-5">{drawSize}</span>
            </div>
          )}
        </div>
      )}

      {/* Selection Options Bar - shows when element is selected */}
      {selectedElement && userRole !== 'Viewer' && (
        <div
          className="absolute z-20 flex items-center gap-2 bg-white rounded-full shadow-excalidraw border border-slate-200 py-3 px-4"
          style={{
            left: selectionToolbarPosition?.left ?? 0,
            top: selectionToolbarPosition?.top ?? 0,
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
            "h-10 w-10 rounded-xl bg-white shadow-excalidraw border border-slate-200 relative",
            isRightPanelOpen && "bg-slate-50 ring-2 ring-primary/10"
          )}
          title="Workspace & Settings"
        >
          <Settings className="size-5 text-slate-600" />
          {newTaskCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
              {newTaskCount}
            </span>
          )}
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
              <ChevronLeft className="size-4" />
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
        <div className="bg-white rounded-xl shadow-excalidraw border border-slate-200 p-4 w-80 h-[600px] flex flex-col gap-4 overflow-hidden">
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
                {rightPanelView === 'main' && (
                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 justify-start relative"
                      onClick={() => setRightPanelView('tasks')}
                    >
                      <CheckSquare className="size-4" />
                      Tasks
                      {newTaskCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                          {newTaskCount}
                        </span>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 justify-start"
                      onClick={() => setRightPanelView('activity')}
                    >
                      <Activity className="size-4" />
                      Activity
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 justify-start"
                      onClick={() => setRightPanelView('comments')}
                    >
                      <MessageCircle className="size-4" />
                      Comments
                    </Button>
                  </div>
                )}
                {rightPanelView === 'tasks' && <TasksPanel onBack={() => setRightPanelView('main')} />}
                {rightPanelView === 'activity' && <ActivityPanel onBack={() => setRightPanelView('main')} />}
                {rightPanelView === 'comments' && <CommentsPanel onBack={() => setRightPanelView('main')} />}
              </div>

              <Separator />

              {/* Feature Toggles */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase font-bold text-slate-400">Features</label>
                <div className="flex flex-col gap-2">
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

                  {/* Generate AI Summary Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start gap-3 h-10 text-xs rounded-lg px-3 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 hover:bg-purple-100"
                    onClick={handleGenerateSummary}
                    disabled={isGeneratingSummary}
                  >
                    {isGeneratingSummary ? (
                      <>
                        <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4 text-purple-500" />
                        Generate AI Summary
                      </>
                    )}
                  </Button>
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
            <DialogTitle>Welcome to Ligma</DialogTitle>
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

      {/* AI Summary Dialog */}
      <Dialog open={isSummaryDialogOpen} onOpenChange={setIsSummaryDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-purple-500" />
              AI Canvas Summary
            </DialogTitle>
            <DialogDescription>
              Generated on {summaryData?.generatedAt ? new Date(summaryData.generatedAt).toLocaleString() : '...'}
            </DialogDescription>
          </DialogHeader>
          {summaryData && (
            <div className="space-y-6 py-4">
              {/* Overview */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-2">Overview</h4>
                <p className="text-sm text-slate-700">{summaryData.overview}</p>
              </div>

              {/* Participants */}
              {summaryData.participants?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Participants</h4>
                  <div className="flex flex-wrap gap-2">
                    {summaryData.participants.map((p: string, i: number) => (
                      <span key={i} className="bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-full">{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Decisions */}
              {summaryData.decisions?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-blue-500" />
                    Decisions
                  </h4>
                  <ul className="space-y-1">
                    {summaryData.decisions.map((d: string, i: number) => (
                      <li key={i} className="text-sm bg-blue-50 px-3 py-2 rounded-lg">{d}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Items */}
              {summaryData.actionItems?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <ListTodo className="size-4 text-red-500" />
                    Action Items
                  </h4>
                  <ul className="space-y-1">
                    {summaryData.actionItems.map((a: string, i: number) => (
                      <li key={i} className="text-sm bg-red-50 px-3 py-2 rounded-lg">{a}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Open Questions */}
              {summaryData.openQuestions?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <HelpCircle className="size-4 text-yellow-600" />
                    Open Questions
                  </h4>
                  <ul className="space-y-1">
                    {summaryData.openQuestions.map((q: string, i: number) => (
                      <li key={i} className="text-sm bg-yellow-50 px-3 py-2 rounded-lg">{q}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Next Steps */}
              {summaryData.nextSteps?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Next Steps</h4>
                  <ul className="space-y-1">
                    {summaryData.nextSteps.map((n: string, i: number) => (
                      <li key={i} className="text-sm bg-green-50 px-3 py-2 rounded-lg">{n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSummaryDialogOpen(false)}>Close</Button>
            <Button onClick={() => {
              if (summaryData) {
                // Generate markdown summary
                let md = `# ${summaryData.overview || 'Canvas Summary'}\n\n`;
                md += `*Generated on ${new Date(summaryData.generatedAt).toLocaleString()}*\n\n`;

                if (summaryData.participants?.length) {
                  md += `## Participants\n${summaryData.participants.map((p: string) => `- ${p}`).join('\n')}\n\n`;
                }
                if (summaryData.decisions?.length) {
                  md += `## Decisions\n${summaryData.decisions.map((d: string) => `- ${d}`).join('\n')}\n\n`;
                }
                if (summaryData.actionItems?.length) {
                  md += `## Action Items\n${summaryData.actionItems.map((a: string) => `- [ ] ${a}`).join('\n')}\n\n`;
                }
                if (summaryData.openQuestions?.length) {
                  md += `## Open Questions\n${summaryData.openQuestions.map((q: string) => `- ${q}`).join('\n')}\n\n`;
                }
                if (summaryData.nextSteps?.length) {
                  md += `## Next Steps\n${summaryData.nextSteps.map((n: string) => `- ${n}`).join('\n')}\n\n`;
                }

                // Download as .md file
                const blob = new Blob([md], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `canvas-summary-${new Date().toISOString().split('T')[0]}.md`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }
            }}>Download Markdown</Button>
            <Button onClick={() => {
              if (summaryData) {
                navigator.clipboard.writeText(JSON.stringify(summaryData, null, 2));
              }
            }}>Copy JSON</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Chat Assistant - Floating Button */}
      {!isChatOpen && (
        <Button
          variant="default"
          size="icon"
          onClick={() => setIsChatOpen(true)}
          className="absolute bottom-24 right-4 z-20 h-12 w-12 rounded-full shadow-lg bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
          title="Open AI Chat Assistant"
        >
          <MessageCircle className="size-5 text-white" />
        </Button>
      )}

      {/* AI Chat Assistant - Panel */}
      {isChatOpen && (
        <div className="absolute bottom-24 right-4 z-20 w-96 h-[500px] shadow-xl">
          <ChatPanel onClose={() => setIsChatOpen(false)} />
        </div>
      )}
    </>
  );
}
