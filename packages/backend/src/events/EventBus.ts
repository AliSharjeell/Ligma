// Event Bus for LIMA - Handles event routing and broadcasting

import { CanvasEvent } from './types';

export type EventHandler = (event: CanvasEvent) => void | Promise<void>;

export class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private globalHandlers: Set<EventHandler> = new Set();

  subscribe(eventType: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
    return () => this.handlers.get(eventType)?.delete(handler);
  }

  subscribeGlobal(handler: EventHandler): () => void {
    this.globalHandlers.add(handler);
    return () => this.globalHandlers.delete(handler);
  }

  async publish(event: CanvasEvent): Promise<void> {
    const typeHandlers = this.handlers.get(event.type);
    if (typeHandlers) {
      await Promise.all(
        Array.from(typeHandlers).map(handler => handler(event))
      );
    }
    await Promise.all(
      Array.from(this.globalHandlers).map(handler => handler(event))
    );
  }

  getHandlerCount(): number {
    let count = this.globalHandlers.size;
    for (const handlers of this.handlers.values()) {
      count += handlers.size;
    }
    return count;
  }
}