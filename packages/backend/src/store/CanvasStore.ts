// Canvas Store - Manages canvas state and coordination

import { EventStore } from '../events/EventStore';
import { StateReconstructor } from '../events/StateReconstructor';
import { RBACService } from '../rbac/RBACService';
import { CanvasState, NodeState } from '../events/types';

export interface CanvasInfo {
  id: string;
  name: string;
  createdAt: number;
  nodeCount: number;
  eventCount: number;
  activeUsers: number;
}

export class CanvasStore {
  private canvases: Map<string, CanvasInfo> = new Map();
  private eventStore: EventStore;
  private stateReconstructor: StateReconstructor;
  private rbac: RBACService;

  constructor(eventStore: EventStore, rbac: RBACService) {
    this.eventStore = eventStore;
    this.stateReconstructor = new StateReconstructor();
    this.rbac = rbac;
  }

  createCanvas(canvasId: string, name: string): CanvasInfo {
    const info: CanvasInfo = {
      id: canvasId,
      name,
      createdAt: Date.now(),
      nodeCount: 0,
      eventCount: 0,
      activeUsers: 0
    };
    this.canvases.set(canvasId, info);
    return info;
  }

  getCanvas(canvasId: string): CanvasState | null {
    const events = this.eventStore.getEvents(canvasId);
    if (events.length === 0) return null;
    return this.stateReconstructor.reconstruct(canvasId, events);
  }

  getCanvasInfo(canvasId: string): CanvasInfo | undefined {
    return this.canvases.get(canvasId);
  }

  updateCanvasInfo(canvasId: string, updates: Partial<CanvasInfo>): void {
    const info = this.canvases.get(canvasId);
    if (info) {
      Object.assign(info, updates);
    }
  }

  getAllCanvases(): CanvasInfo[] {
    return Array.from(this.canvases.values());
  }

  getNode(canvasId: string, nodeId: string): NodeState | undefined {
    const state = this.getCanvas(canvasId);
    return state?.nodes.get(nodeId);
  }

  updateNode(canvasId: string, nodeId: string, updates: Partial<NodeState>): void {
    // In event-sourced architecture, this updates the in-memory reconstructed state
    // Real persistence happens through events
    const state = this.getCanvas(canvasId);
    if (state) {
      const node = state.nodes.get(nodeId);
      if (node) {
        Object.assign(node, updates);
      }
    }
  }

  validatePermission(userId: string, canvasId: string, action: 'create' | 'read' | 'update' | 'delete'): boolean {
    return this.rbac.canPerformAction(userId, canvasId, `can${action.charAt(0).toUpperCase() + action.slice(1)}` as any);
  }

  getStats(): { canvasCount: number; totalEvents: number; totalNodes: number } {
    let totalEvents = 0;
    let totalNodes = 0;

    for (const canvasId of this.canvases.keys()) {
      totalEvents += this.eventStore.getEventCount(canvasId);
      const state = this.getCanvas(canvasId);
      totalNodes += state?.nodes.size || 0;
    }

    return {
      canvasCount: this.canvases.size,
      totalEvents,
      totalNodes
    };
  }
}