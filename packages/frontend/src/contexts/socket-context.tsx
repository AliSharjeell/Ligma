'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useCanvasStore } from '@/store/canvas-store';
import type { CanvasElement, CanvasEvent, Position, ShapeType, Size, Task, User } from '@/types/canvas';

type NodeCreatedEvent = {
  id: string;
  type: 'NodeCreated';
  canvasId: string;
  userId: string;
  nodeId: string;
  nodeType: 'text' | 'shape' | 'image' | 'sticky' | 'drawing';
  position: Position;
  content: string;
  timestamp: number;
  metadata?: {
    size?: Size;
    color?: string;
    shapeType?: ShapeType;
    points?: Position[];
    style?: Record<string, unknown>;
  };
};

type NodeUpdatedEvent = {
  id: string;
  type: 'NodeUpdated';
  canvasId: string;
  userId: string;
  nodeId: string;
  changes: Partial<{
    content: string;
    position: Position;
    style: Record<string, unknown>;
    size: Size;
    color: string;
    shapeType: ShapeType;
    points: Position[];
  }>;
  timestamp: number;
};

type NodeDeletedEvent = {
  id: string;
  type: 'NodeDeleted';
  canvasId: string;
  userId: string;
  nodeId: string;
  timestamp: number;
};

type NodeLockedEvent = {
  id: string;
  type: 'NodeLocked';
  canvasId: string;
  userId: string;
  nodeId: string;
  lockedBy: string;
};

type NodeUnlockedEvent = {
  id: string;
  type: 'NodeUnlocked';
  canvasId: string;
  userId: string;
  nodeId: string;
};

type UserJoinedEvent = {
  id: string;
  type: 'UserJoined';
  canvasId: string;
  userId: string;
  userName: string;
  role: 'Lead' | 'Contributor' | 'Viewer';
};

type UserLeftEvent = {
  userId: string;
  userName?: string;
};

type ActivitySyncPayload = {
  events: CanvasEvent[];
};

type TaskDto = {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  assignee?: string;
  priority?: 'low' | 'medium' | 'high';
};

type TasksListPayload = {
  tasks: TaskDto[];
};

type UserDto = {
  userId: string;
  userName: string;
  role: 'Lead' | 'Contributor' | 'Viewer';
};

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

// Offline queue types
interface QueuedEvent {
  id: string;
  timestamp: number;
  type: 'create' | 'update' | 'delete' | 'lock' | 'unlock';
  eventType: string;
  canvasId: string;
  payload: any;
}

const QUEUE_KEY = 'ligma-offline-queue';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  connectionStatus: ConnectionStatus;
  pendingCount: number;
  emitElementCreate: (element: CanvasElement) => void;
  emitElementUpdate: (element: CanvasElement) => void;
  emitElementDelete: (elementId: string) => void;
  emitElementLock: (elementId: string) => void;
  emitElementUnlock: (elementId: string) => void;
  emitCursorMove: (position: Position) => void;
  emitTaskCreate: (task: { title: string; description?: string; priority: 'low' | 'medium' | 'high' }) => void;
  emitTaskUpdate: (taskId: string, status: 'pending' | 'in-progress' | 'completed') => void;
  emitTaskDelete: (taskId: string) => void;
  emitChangeRole: (targetUserId: string, newRole: 'Lead' | 'Contributor' | 'Viewer') => void;
  emitRoleRequest: (requestedRole: 'Contributor') => void;
  emitApproveRoleRequest: (targetUserId: string) => void;
  emitDenyRoleRequest: (targetUserId: string) => void;
  emitTransferOwnership: (targetUserId: string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
  connectionStatus: 'disconnected',
  pendingCount: 0,
  emitElementCreate: () => {},
  emitElementUpdate: () => {},
  emitElementDelete: () => {},
  emitElementLock: () => {},
  emitElementUnlock: () => {},
  emitCursorMove: () => {},
  emitTaskCreate: () => {},
  emitTaskUpdate: () => {},
  emitTaskDelete: () => {},
  emitChangeRole: () => {},
  emitRoleRequest: () => {},
  emitApproveRoleRequest: () => {},
  emitDenyRoleRequest: () => {},
  emitTransferOwnership: () => {},
});

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  children: React.ReactNode;
  url?: string;
  canvasId?: string;
}

// Load queue from localStorage
function loadQueue(): QueuedEvent[] {
  try {
    const saved = localStorage.getItem(QUEUE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

// Save queue to localStorage
function saveQueue(queue: QueuedEvent[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to save offline queue:', e);
  }
}

export function SocketProvider({ children, url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001', canvasId = 'default' }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [pendingCount, setPendingCount] = useState(0);
  const queueRef = useRef<QueuedEvent[]>(loadQueue());

  const {
    userId,
    userName,
    addRemoteElement,
    updateElement,
    deleteElement,
    lockElement,
    unlockElement,
    updateUserCursor,
    addUser,
    removeUser,
    addRemoteEvent,
    setEventLog,
    setTasks,
    addRemoteTask,
    updateTask,
    deleteTask,
    setElements,
    resetCanvas,
    setUserRole,
    setUsers,
    persistElements,
  } = useCanvasStore();

  // Sync pending count with queue length
  useEffect(() => {
    setPendingCount(queueRef.current.length);
  }, []);

  const toTask = useCallback((task: TaskDto): Task => {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status === 'in_progress' ? 'in-progress' : task.status,
      assignee: task.assignee,
      priority: task.priority || 'medium',
    };
  }, []);

  const toCanvasElement = useCallback((event: NodeCreatedEvent): CanvasElement => {
    const now = Date.now();
    const defaultSizeByType: Partial<Record<NodeCreatedEvent['nodeType'], Size>> = {
      sticky: { width: 200, height: 150 },
      text: { width: 200, height: 40 },
      shape: { width: 160, height: 120 },
      drawing: { width: 0, height: 0 },
      image: { width: 240, height: 180 },
    };
    const fallbackSize = defaultSizeByType[event.nodeType] || { width: 200, height: 120 };
    return {
      id: event.nodeId,
      type: event.nodeType,
      position: event.position,
      size: event.metadata?.size || fallbackSize,
      content: event.content || '',
      color: event.metadata?.color || '#1f2937',
      shapeType: event.metadata?.shapeType,
      points: event.metadata?.points,
      textStyle: event.metadata?.style as CanvasElement['textStyle'] | undefined,
      locked: false,
      createdBy: event.userId,
      createdAt: now,
      updatedAt: now,
    };
  }, []);

  const nodeStateToCanvasElement = useCallback((node: any): CanvasElement => {
    const defaultSizeByType: Partial<Record<string, Size>> = {
      sticky: { width: 200, height: 150 },
      text: { width: 200, height: 40 },
      shape: { width: 160, height: 120 },
      drawing: { width: 0, height: 0 },
      image: { width: 240, height: 180 },
    };
    const fallbackSize = defaultSizeByType[node.type] || { width: 200, height: 120 };
    return {
      id: node.id,
      type: node.type,
      position: node.position,
      size: node.size || fallbackSize,
      content: node.content || '',
      color: node.color || '#1f2937',
      shapeType: node.shapeType,
      points: node.points,
      textStyle: node.style as CanvasElement['textStyle'] | undefined,
      locked: !!node.lockedBy,
      lockedBy: node.lockedBy,
      createdBy: node.createdBy || 'unknown',
      createdAt: node.createdAt || Date.now(),
      updatedAt: node.updatedAt || Date.now(),
    };
  }, []);

  const toUser = useCallback((event: UserJoinedEvent): User => {
    return {
      id: event.userId,
      name: event.userName,
      color: '#16a34a',
      role: event.role,
    };
  }, []);

  // Replay queued events
  const replayQueue = useCallback((socketInstance: Socket) => {
    const queue = queueRef.current;
    if (queue.length === 0) return;

    console.log(`Replaying ${queue.length} queued events...`);
    setConnectionStatus('connecting');

    queue.forEach((event, index) => {
      setTimeout(() => {
        switch (event.eventType) {
          case 'create_node':
            socketInstance.emit('create_node', event.payload);
            break;
          case 'update_node':
            socketInstance.emit('update_node', event.payload);
            break;
          case 'delete_node':
            socketInstance.emit('delete_node', event.payload);
            break;
          case 'lock_node':
            socketInstance.emit('lock_node', event.payload);
            break;
          case 'unlock_node':
            socketInstance.emit('unlock_node', event.payload);
            break;
          // Role-related events
          case 'role_request':
            socketInstance.emit('request_role', event.payload);
            break;
          case 'approve_role_request':
            socketInstance.emit('approve_role_request', event.payload);
            break;
          case 'deny_role_request':
            socketInstance.emit('deny_role_request', event.payload);
            break;
          case 'transfer_ownership':
            socketInstance.emit('transfer_ownership', event.payload);
            break;
          default:
            console.log('Unknown event type:', event.eventType);
        }
      }, index * 50); // Small delay between events
    });

    // Clear queue after replay
    setTimeout(() => {
      queueRef.current = [];
      saveQueue([]);
      setPendingCount(0);
      console.log('Offline queue replayed and cleared');
    }, queue.length * 50 + 100);
  }, []);

  // Listen for online/offline events - update status immediately
  useEffect(() => {
    const handleOnline = () => {
      console.log('Browser online');
      // Don't set to connected here - wait for socket to actually connect
    };

    const handleOffline = () => {
      console.log('Browser offline');
      // Immediately set to disconnected so user sees the indicator
      setConnectionStatus('disconnected');
      setConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    if (!navigator.onLine) {
      setConnectionStatus('disconnected');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // Immediately set connecting status when attempting connection
    setConnectionStatus('connecting');

    const newSocket = io(url, {
      query: { userId, userName },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000, // Faster reconnection
      timeout: 5000, // Faster timeout
    });

    newSocket.on('connect', () => {
      setConnected(true);
      setConnectionStatus('connected');
      console.log('Connected to WebSocket server');

      // Replay offline queue on reconnect
      if (queueRef.current.length > 0) {
        replayQueue(newSocket);
      }

      // Clear old state when joining a new canvas
      resetCanvas();
      newSocket.emit('join_canvas', {
        canvasId,
        userId,
        userName,
      });
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      setConnectionStatus('disconnected');
      console.log('Disconnected from WebSocket server');
    });

    newSocket.on('connect_error', () => {
      setConnectionStatus('disconnected');
    });

    newSocket.on('sync_response', (payload: { state: { nodes: any[] } }) => {
      if (payload.state && payload.state.nodes) {
        const elements = payload.state.nodes.map(nodeStateToCanvasElement);
        setElements(elements);
        persistElements(canvasId);
        console.log('Synchronized canvas state:', elements.length, 'elements');
      }
    });

    newSocket.on('initial_users', (payload: { users: UserDto[], yourRole: 'Lead' | 'Contributor' | 'Viewer' }) => {
      const formattedUsers: User[] = payload.users.map(u => ({
        id: u.userId,
        name: u.userName,
        role: u.role,
        color: '#16a34a',
      }));
      setUsers(formattedUsers);
      setUserRole(payload.yourRole);
      console.log('Initial users synced. Your role:', payload.yourRole);
    });

    newSocket.on('role_changed', (payload: { userId: string, newRole: 'Lead' | 'Contributor' | 'Viewer' }) => {
      if (payload.userId === userId) {
        setUserRole(payload.newRole);
      }
      const existingUsers = useCanvasStore.getState().users;
      const user = existingUsers.get(payload.userId);
      if (user) {
        addUser({ ...user, role: payload.newRole });
      }
      console.log('Role changed for user:', payload.userId, 'to', payload.newRole);
    });

    newSocket.on('role_request', (payload: { userId: string; userName: string; requestedRole: string }) => {
      console.log('Role request from:', payload.userName, 'for', payload.requestedRole);
    });

    newSocket.on('role_request_approved', (payload: { userId: string }) => {
      if (payload.userId === userId) {
        setUserRole('Contributor');
        alert('Your Contributor request was approved! You can now edit.');
      }
    });

    newSocket.on('role_request_denied', () => {
      // This is just logged - actual handling is in Toolbar component
      console.log('Role request denied received');
    });

    newSocket.on('ownership_transferred', (payload: { oldOwnerId: string; newOwnerId: string }) => {
      if (payload.newOwnerId === userId) {
        setUserRole('Lead');
        alert('You are now the Lead of this room!');
      }
      console.log('Ownership transferred from', payload.oldOwnerId, 'to', payload.newOwnerId);
    });

    newSocket.on('node_created', (event: NodeCreatedEvent) => {
      addRemoteElement(toCanvasElement(event));
      console.log('Node created:', event);
    });

    newSocket.on('node_updated', (event: NodeUpdatedEvent) => {
      const nextChanges: Partial<CanvasElement> = {
        ...event.changes,
      };
      if (event.changes.style) {
        nextChanges.textStyle = event.changes.style as CanvasElement['textStyle'];
      }
      updateElement(event.nodeId, nextChanges);
      console.log('Node updated:', event);
    });

    newSocket.on('node_deleted', (event: NodeDeletedEvent) => {
      console.log('Node deleted:', event);
      deleteElement(event.nodeId);
    });

    newSocket.on('node_locked', (event: NodeLockedEvent) => {
      lockElement(event.nodeId);
    });

    newSocket.on('node_unlocked', (event: NodeUnlockedEvent) => {
      unlockElement(event.nodeId);
    });

    newSocket.on('cursor_moved', ({ userId: cursorUserId, position }: { userId: string; position: Position }) => {
      if (cursorUserId !== userId) {
        updateUserCursor(cursorUserId, position);
      }
    });

    newSocket.on('user_joined', (event: UserJoinedEvent) => {
      addUser(toUser(event));
    });

    newSocket.on('user_left', (event: UserLeftEvent) => {
      removeUser(event.userId);
    });

    newSocket.on('activity_sync', (payload: ActivitySyncPayload) => {
      setEventLog(payload.events || []);
    });

    newSocket.on('activity_event', (event: CanvasEvent) => {
      addRemoteEvent(event);
    });

    newSocket.on('tasks_list', (payload: TasksListPayload) => {
      setTasks((payload.tasks || []).map(toTask));
    });

    newSocket.on('task_created', (task: TaskDto) => {
      addRemoteTask(toTask(task));
    });

    newSocket.on('task_updated', ({ taskId, status }: { taskId: string; status: TaskDto['status'] }) => {
      updateTask(taskId, { status: status === 'in_progress' ? 'in-progress' : status });
    });

    newSocket.on('task_deleted', ({ taskId }: { taskId: string }) => {
      deleteTask(taskId);
    });

    setSocket(newSocket);

    if (typeof window !== 'undefined') {
      (window as any).__socket = newSocket;
    }

    return () => {
      newSocket.disconnect();
    };
  }, [url, userId, userName, canvasId, addRemoteElement, updateElement, deleteElement, lockElement, unlockElement, updateUserCursor, addUser, removeUser, addRemoteEvent, setEventLog, setTasks, addRemoteTask, updateTask, deleteTask, toCanvasElement, toUser, toTask, setElements, nodeStateToCanvasElement, setUsers, setUserRole, resetCanvas, replayQueue, persistElements]);

  const addToQueue = useCallback((event: Omit<QueuedEvent, 'id' | 'timestamp'>) => {
    const queuedEvent: QueuedEvent = {
      ...event,
      id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    queueRef.current = [...queueRef.current, queuedEvent];
    saveQueue(queueRef.current);
    setPendingCount(queueRef.current.length);
  }, []);

  const emitElementCreate = useCallback((element: CanvasElement) => {
    if (element.type === 'drawing') {
      const payload = {
        canvasId,
        nodeId: element.id,
        nodeType: 'drawing',
        position: element.position,
        content: '',
        size: element.size,
        points: element.points,
        color: element.color,
      };
      if (connected) {
        socket?.emit('create_node', payload);
      } else {
        addToQueue({ type: 'create', eventType: 'create_node', canvasId, payload });
      }
    } else {
      const payload = {
        canvasId,
        nodeId: element.id,
        nodeType: element.type,
        position: element.position,
        content: element.content,
        size: element.size,
        color: element.color,
        shapeType: element.shapeType,
        style: element.textStyle,
      };
      if (connected) {
        socket?.emit('create_node', payload);
      } else {
        addToQueue({ type: 'create', eventType: 'create_node', canvasId, payload });
      }
    }
  }, [socket, canvasId, connected, addToQueue]);

  const emitElementUpdate = useCallback((element: CanvasElement) => {
    const payload = {
      canvasId,
      nodeId: element.id,
      changes: {
        content: element.content,
        position: element.position,
        size: element.size,
        color: element.color,
        shapeType: element.shapeType,
        points: element.points,
        style: element.textStyle,
      },
      vectorClock: {},
    };
    if (connected) {
      socket?.emit('update_node', payload);
    } else {
      addToQueue({ type: 'update', eventType: 'update_node', canvasId, payload });
    }
  }, [socket, canvasId, connected, addToQueue]);

  const emitElementDelete = useCallback((elementId: string) => {
    const payload = { canvasId, nodeId: elementId };
    if (connected) {
      socket?.emit('delete_node', payload);
    } else {
      addToQueue({ type: 'delete', eventType: 'delete_node', canvasId, payload });
    }
  }, [socket, canvasId, connected, addToQueue]);

  const emitElementLock = useCallback((elementId: string) => {
    const payload = { canvasId, nodeId: elementId };
    if (connected) {
      socket?.emit('lock_node', payload);
    } else {
      addToQueue({ type: 'lock', eventType: 'lock_node', canvasId, payload });
    }
  }, [socket, canvasId, connected, addToQueue]);

  const emitElementUnlock = useCallback((elementId: string) => {
    const payload = { canvasId, nodeId: elementId };
    if (connected) {
      socket?.emit('unlock_node', payload);
    } else {
      addToQueue({ type: 'unlock', eventType: 'unlock_node', canvasId, payload });
    }
  }, [socket, canvasId, connected, addToQueue]);

  const emitCursorMove = useCallback((position: Position) => {
    socket?.emit('cursor_move', { canvasId, position });
  }, [socket, canvasId]);

  const emitTaskCreate = useCallback((task: { title: string; description?: string; priority: 'low' | 'medium' | 'high' }) => {
    socket?.emit('create_task', { canvasId, ...task });
  }, [socket, canvasId]);

  const emitTaskUpdate = useCallback((taskId: string, status: 'pending' | 'in-progress' | 'completed') => {
    socket?.emit('update_task_status', { taskId, status: status === 'in-progress' ? 'in_progress' : status });
  }, [socket]);

  const emitTaskDelete = useCallback((taskId: string) => {
    socket?.emit('delete_task', { taskId });
  }, [socket]);

  const emitChangeRole = useCallback((targetUserId: string, newRole: 'Lead' | 'Contributor' | 'Viewer') => {
    socket?.emit('change_role', { canvasId, targetUserId, newRole });
  }, [socket, canvasId]);

  const emitRoleRequest = useCallback((requestedRole: 'Contributor') => {
    const payload = { canvasId, requestedRole };
    if (connected && socket) {
      socket.emit('request_role', payload);
    } else {
      // Queue for later if offline
      addToQueue({ type: 'create', eventType: 'role_request', canvasId, payload });
    }
  }, [socket, canvasId, connected, addToQueue]);

  const emitApproveRoleRequest = useCallback((targetUserId: string) => {
    const payload = { canvasId, targetUserId };
    if (connected && socket) {
      socket.emit('approve_role_request', payload);
    } else {
      addToQueue({ type: 'create', eventType: 'approve_role_request', canvasId, payload });
    }
  }, [socket, canvasId, connected, addToQueue]);

  const emitDenyRoleRequest = useCallback((targetUserId: string) => {
    console.log('emitDenyRoleRequest called:', targetUserId, 'connected:', connected);
    const payload = { canvasId, targetUserId };
    if (connected && socket) {
      console.log('Emitting deny_role_request');
      socket.emit('deny_role_request', payload);
    } else {
      console.log('Queuing deny_role_request (offline)');
      addToQueue({ type: 'create', eventType: 'deny_role_request', canvasId, payload });
    }
  }, [socket, canvasId, connected, addToQueue]);

  const emitTransferOwnership = useCallback((targetUserId: string) => {
    const payload = { canvasId, targetUserId };
    if (connected && socket) {
      socket.emit('transfer_ownership', payload);
    } else {
      addToQueue({ type: 'create', eventType: 'transfer_ownership', canvasId, payload });
    }
  }, [socket, canvasId, connected, addToQueue]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        connectionStatus,
        pendingCount,
        emitElementCreate,
        emitElementUpdate,
        emitElementDelete,
        emitElementLock,
        emitElementUnlock,
        emitCursorMove,
        emitTaskCreate,
        emitTaskUpdate,
        emitTaskDelete,
        emitChangeRole,
        emitRoleRequest,
        emitApproveRoleRequest,
        emitDenyRoleRequest,
        emitTransferOwnership,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}