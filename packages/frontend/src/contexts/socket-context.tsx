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

    newSocket.on('element:create', (element: CanvasElement) => {
      addElement(element);
    });

    newSocket.on('element:update', (element: CanvasElement) => {
      updateElement(element.id, element);
    });

    newSocket.on('element:delete', (elementId: string) => {
      deleteElement(elementId);
    });

    newSocket.on('element:lock', ({ elementId }: { elementId: string; userId: string }) => {
      lockElement(elementId);
    });

    newSocket.on('element:unlock', (elementId: string) => {
      unlockElement(elementId);
    });

    newSocket.on('cursor:move', ({ userId: cursorUserId, position }: { userId: string; position: Position }) => {
      if (cursorUserId !== userId) {
        updateUserCursor(cursorUserId, position);
      }
    });

    newSocket.on('user:join', (user: User) => {
      addUser(user);
    });

    newSocket.on('user:leave', (leftUserId: string) => {
      removeUser(leftUserId);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [url, userId, userName]);

  const emitElementCreate = useCallback((element: CanvasElement) => {
    socket?.emit('element:create', element);
  }, [socket]);

  const emitElementUpdate = useCallback((element: CanvasElement) => {
    socket?.emit('element:update', element);
  }, [socket]);

  const emitElementDelete = useCallback((elementId: string) => {
    socket?.emit('element:delete', elementId);
  }, [socket]);

  const emitElementLock = useCallback((elementId: string) => {
    socket?.emit('element:lock', elementId);
  }, [socket]);

  const emitElementUnlock = useCallback((elementId: string) => {
    socket?.emit('element:unlock', elementId);
  }, [socket]);

  const emitCursorMove = useCallback((position: Position) => {
    socket?.emit('cursor:move', { userId, position });
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