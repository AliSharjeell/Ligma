import { useState, useEffect, useCallback, useRef } from 'react';
import type { CanvasElement, Position, ShapeType, Size } from '@/types/canvas';

const QUEUE_KEY = 'ligma-offline-queue';
const LAST_SYNC_KEY = 'ligma-last-sync';

export interface QueuedEvent {
  id: string;
  timestamp: number;
  type: 'create' | 'update' | 'delete' | 'lock' | 'unlock';
  eventType: string;
  canvasId: string;
  payload: any;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

interface UseOfflineQueueReturn {
  status: ConnectionStatus;
  pendingCount: number;
  queue: QueuedEvent[];
  addToQueue: (event: Omit<QueuedEvent, 'id' | 'timestamp'>) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  getQueue: () => QueuedEvent[];
  setStatus: (status: ConnectionStatus) => void;
  markSyncing: () => void;
  markSynced: () => void;
}

export function useOfflineQueue(): UseOfflineQueueReturn {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [queue, setQueue] = useState<QueuedEvent[]>([]);

  // Load queue from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(QUEUE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setQueue(parsed);
          console.log(`Loaded ${parsed.length} queued events from localStorage`);
        }
      }
    } catch (e) {
      console.error('Failed to load offline queue:', e);
    }
  }, []);

  // Save queue to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('Failed to save offline queue:', e);
      // If localStorage is full, we might need to handle this
      if (e.name === 'QuotaExceededError') {
        console.warn('localStorage is full! Consider clearing old events.');
      }
    }
  }, [queue]);

  const addToQueue = useCallback((event: Omit<QueuedEvent, 'id' | 'timestamp'>) => {
    const queuedEvent: QueuedEvent = {
      ...event,
      id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    setQueue(prev => {
      // Cap at 1000 events to prevent localStorage overflow
      const next = [...prev, queuedEvent];
      if (next.length > 1000) {
        console.warn('Offline queue exceeded 1000 events, oldest events dropped');
        return next.slice(-1000);
      }
      return next;
    });
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => prev.filter(e => e.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    localStorage.removeItem(QUEUE_KEY);
    localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
  }, []);

  const getQueue = useCallback(() => queue, [queue]);

  const markSyncing = useCallback(() => {
    setStatus('connecting');
  }, []);

  const markSynced = useCallback(() => {
    setStatus('connected');
    localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
  }, []);

  return {
    status,
    pendingCount: queue.length,
    queue,
    addToQueue,
    removeFromQueue,
    clearQueue,
    getQueue,
    setStatus,
    markSyncing,
    markSynced,
  };
}

// Helper to check if we're online
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

// Helper to get last sync time
export function getLastSyncTime(): number | null {
  try {
    const saved = localStorage.getItem(LAST_SYNC_KEY);
    return saved ? parseInt(saved, 10) : null;
  } catch {
    return null;
  }
}