// Append-Only Event Store for LIMA

import { v4 as uuidv4 } from 'uuid';
import { CanvasEvent, BaseEvent } from './types';

export class EventStore {
  private events: Map<string, CanvasEvent[]> = new Map();
  private eventIndex: Map<string, CanvasEvent> = new Map();

  append(event: CanvasEvent): CanvasEvent {
    const canvasId = event.canvasId;
    if (!this.events.has(canvasId)) {
      this.events.set(canvasId, []);
    }
    this.events.get(canvasId)!.push(event);
    this.eventIndex.set(event.id, event);
    return event;
  }

  getEvents(canvasId: string, fromTimestamp?: number): CanvasEvent[] {
    const events = this.events.get(canvasId) || [];
    if (fromTimestamp !== undefined) {
      return events.filter(e => e.timestamp > fromTimestamp);
    }
    return [...events];
  }

  getEventsSince(canvasId: string, lastEventId: string): CanvasEvent[] {
    const events = this.events.get(canvasId) || [];
    const lastEvent = this.eventIndex.get(lastEventId);
    if (!lastEvent) {
      return events;
    }
    return events.filter(e => e.timestamp > lastEvent.timestamp);
  }

  getEventById(eventId: string): CanvasEvent | undefined {
    return this.eventIndex.get(eventId);
  }

  getAllCanvasIds(): string[] {
    return Array.from(this.events.keys());
  }

  getEventCount(canvasId: string): number {
    return this.events.get(canvasId)?.length || 0;
  }

  clear(): void {
    this.events.clear();
    this.eventIndex.clear();
  }
}

export function createBaseEvent(
  canvasId: string,
  userId: string,
  type: BaseEvent['type'],
  vectorClock: Record<string, number>
): BaseEvent {
  return {
    id: uuidv4(),
    type,
    canvasId,
    userId,
    timestamp: Date.now(),
    vectorClock: { ...vectorClock }
  };
}