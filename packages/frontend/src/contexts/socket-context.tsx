'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useCanvasStore } from '@/store/canvas-store';
import type { CanvasElement, Position, User } from '@/types/canvas';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  emitElementCreate: (element: CanvasElement) => void;
  emitElementUpdate: (element: CanvasElement) => void;
  emitElementDelete: (elementId: string) => void;
  emitElementLock: (elementId: string) => void;
  emitElementUnlock: (elementId: string) => void;
  emitCursorMove: (position: Position) => void;
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
});

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  children: React.ReactNode;
  url?: string;
}

export function SocketProvider({ children, url = 'http://localhost:3001' }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  const {
    userId,
    userName,
    addElement,
    updateElement,
    deleteElement,
    lockElement,
    unlockElement,
    updateUserCursor,
    addUser,
    removeUser,
  } = useCanvasStore();

  useEffect(() => {
    const newSocket = io(url, {
      query: { userId, userName },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      setConnected(true);
      console.log('Connected to WebSocket server');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected from WebSocket server');
    });

    newSocket.on('node_created', (element: CanvasElement) => {
      addElement(element);
    });

    newSocket.on('node_updated', (element: CanvasElement) => {
      updateElement(element.id, element);
    });

    newSocket.on('node_deleted', (elementId: string) => {
      deleteElement(elementId);
    });

    newSocket.on('node_locked', ({ elementId }: { elementId: string; userId: string }) => {
      lockElement(elementId);
    });

    newSocket.on('node_unlocked', (elementId: string) => {
      unlockElement(elementId);
    });

    newSocket.on('cursor_moved', ({ userId: cursorUserId, position }: { userId: string; position: Position }) => {
      if (cursorUserId !== userId) {
        updateUserCursor(cursorUserId, position);
      }
    });

    newSocket.on('user_joined', (user: User) => {
      addUser(user);
    });

    newSocket.on('user_left', (leftUserId: string) => {
      removeUser(leftUserId);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [url, userId, userName]);

  const emitElementCreate = useCallback((element: CanvasElement) => {
    socket?.emit('create_node', element);
  }, [socket]);

  const emitElementUpdate = useCallback((element: CanvasElement) => {
    socket?.emit('update_node', element);
  }, [socket]);

  const emitElementDelete = useCallback((elementId: string) => {
    socket?.emit('delete_node', elementId);
  }, [socket]);

  const emitElementLock = useCallback((elementId: string) => {
    socket?.emit('lock_node', elementId);
  }, [socket]);

  const emitElementUnlock = useCallback((elementId: string) => {
    socket?.emit('unlock_node', elementId);
  }, [socket]);

  const emitCursorMove = useCallback((position: Position) => {
    socket?.emit('cursor_move', { userId, position });
  }, [socket, userId]);

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
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}