'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  emitElementCreate: (element: CanvasElement) => void;
  emitElementUpdate: (element: CanvasElement) => void;
  emitElementDelete: (elementId: string) => void;
  emitElementLock: (elementId: string) => void;
  emitElementUnlock: (elementId: string) => void;
  emitCursorMove: (position: Position) => void;
  emitTaskCreate: (task: { title: string; description?: string; priority: 'low' | 'medium' | 'high' }) => void;
  emitTaskUpdate: (taskId: string, status: 'pending' | 'in-progress' | 'completed') => void;
  emitTaskDelete: (taskId: string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
  emitElementCreate: () => {},
  emitElementUpdate: () => {},
  emitElementDelete: () => {},
  emitElementLock: () => {},
  emitElementUnlock: () => {},
  emitCursorMove: () => {},
  emitTaskCreate: () => {},
  emitTaskUpdate: () => {},
  emitTaskDelete: () => {},
});

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  children: React.ReactNode;
  url?: string;
  canvasId?: string;
}

export function SocketProvider({ children, url = 'http://localhost:3001', canvasId = 'default' }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

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
  } = useCanvasStore();

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
    };
  }, []);

  useEffect(() => {
    const newSocket = io(url, {
      query: { userId, userName },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      setConnected(true);
      console.log('Connected to WebSocket server');
      newSocket.emit('join_canvas', {
        canvasId,
        userId,
        userName,
        role: 'Contributor',
      });
      newSocket.emit('get_tasks', { canvasId });
      newSocket.emit('request_sync', { canvasId });
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected from WebSocket server');
    });

    newSocket.on('sync_response', (payload: { state: { nodes: any[] } }) => {
      if (payload.state && payload.state.nodes) {
        const elements = payload.state.nodes.map(nodeStateToCanvasElement);
        setElements(elements);
        console.log('Synchronized canvas state:', elements.length, 'elements');
      }
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

    return () => {
      newSocket.disconnect();
    };
  }, [url, userId, userName, canvasId, addRemoteElement, updateElement, deleteElement, lockElement, unlockElement, updateUserCursor, addUser, removeUser, addRemoteEvent, setEventLog, setTasks, addRemoteTask, updateTask, deleteTask, toCanvasElement, toUser, toTask, setElements, nodeStateToCanvasElement]);

  const emitElementCreate = useCallback((element: CanvasElement) => {
    // For drawing elements, use create_node with nodeType='drawing'
    if (element.type === 'drawing') {
      socket?.emit('create_node', {
        canvasId,
        nodeId: element.id,
        nodeType: 'drawing',
        position: element.position,
        content: '',
        size: element.size,
        points: element.points,
        color: element.color,
      });
    } else {
      socket?.emit('create_node', {
        canvasId,
        nodeId: element.id,
        nodeType: element.type,
        position: element.position,
        content: element.content,
        size: element.size,
        color: element.color,
        shapeType: element.shapeType,
        style: element.textStyle,
      });
    }
  }, [socket, canvasId]);

  const emitElementUpdate = useCallback((element: CanvasElement) => {
    socket?.emit('update_node', {
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
    });
  }, [socket, canvasId]);

  const emitElementDelete = useCallback((elementId: string) => {
    socket?.emit('delete_node', { canvasId, nodeId: elementId });
  }, [socket, canvasId]);

  const emitElementLock = useCallback((elementId: string) => {
    socket?.emit('lock_node', { canvasId, nodeId: elementId });
  }, [socket, canvasId]);

  const emitElementUnlock = useCallback((elementId: string) => {
    socket?.emit('unlock_node', { canvasId, nodeId: elementId });
  }, [socket, canvasId]);

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

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        emitElementCreate,
        emitElementUpdate,
        emitElementDelete,
        emitElementLock,
        emitElementUnlock,
        emitCursorMove,
        emitTaskCreate,
        emitTaskUpdate,
        emitTaskDelete,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}