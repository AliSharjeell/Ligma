// State Reconstructor - Rebuilds canvas state from event log

import {
  CanvasState,
  NodeState,
  CanvasEvent,
  NodeCreatedEvent,
  NodeUpdatedEvent,
  NodeDeletedEvent,
  NodeLockedEvent,
  NodeUnlockedEvent
} from './types';

export class StateReconstructor {
  reconstruct(canvasId: string, events: CanvasEvent[]): CanvasState {
    const nodes = new Map<string, NodeState>();
    let lastEventId = '';
    const vectorClock: Record<string, number> = {};

    for (const event of events) {
      this.updateVectorClock(vectorClock, event);
      lastEventId = event.id;

      switch (event.type) {
        case 'NodeCreated':
          this.applyNodeCreated(nodes, event as NodeCreatedEvent);
          break;
        case 'NodeUpdated':
          this.applyNodeUpdated(nodes, event as NodeUpdatedEvent);
          break;
        case 'NodeDeleted':
          this.applyNodeDeleted(nodes, event as NodeDeletedEvent);
          break;
        case 'NodeLocked':
          this.applyNodeLocked(nodes, event as NodeLockedEvent);
          break;
        case 'NodeUnlocked':
          this.applyNodeUnlocked(nodes, event as NodeUnlockedEvent);
          break;
      }
    }

    return {
      canvasId,
      nodes,
      lastEventId,
      vectorClock
    };
  }

  private updateVectorClock(
    clock: Record<string, number>,
    event: CanvasEvent
  ): void {
    for (const [clientId, counter] of Object.entries(event.vectorClock)) {
      clock[clientId] = Math.max(clock[clientId] || 0, counter);
    }
    clock[event.userId] = (clock[event.userId] || 0) + 1;
  }

  private applyNodeCreated(nodes: Map<string, NodeState>, event: NodeCreatedEvent): void {
    const node: NodeState = {
      id: event.nodeId,
      type: event.nodeType,
      position: event.position,
      content: event.content,
      version: 1,
      createdAt: event.timestamp,
      createdBy: event.userId,
      updatedAt: event.timestamp,
      ...event.metadata
    };
    nodes.set(event.nodeId, node);
  }

  private applyNodeUpdated(nodes: Map<string, NodeState>, event: NodeUpdatedEvent): void {
    const node = nodes.get(event.nodeId);
    if (node) {
      if (event.changes.content !== undefined) {
        node.content = event.changes.content;
      }
      if (event.changes.position !== undefined) {
        node.position = event.changes.position;
      }
      if (event.changes.style !== undefined) {
        node.style = { ...node.style, ...event.changes.style };
      }
      if (event.changes.size !== undefined) {
        node.size = event.changes.size;
      }
      if (event.changes.color !== undefined) {
        node.color = event.changes.color;
      }
      if (event.changes.shapeType !== undefined) {
        node.shapeType = event.changes.shapeType;
      }
      if (event.changes.points !== undefined) {
        node.points = event.changes.points;
      }
      if (event.changes.groupId !== undefined) {
        node.groupId = event.changes.groupId === null ? undefined : event.changes.groupId;
      }
      node.version = event.version;
      node.updatedAt = event.timestamp;
    }
  }

  private applyNodeDeleted(nodes: Map<string, NodeState>, event: NodeDeletedEvent): void {
    nodes.delete(event.nodeId);
  }

  private applyNodeLocked(nodes: Map<string, NodeState>, event: NodeLockedEvent): void {
    const node = nodes.get(event.nodeId);
    if (node) {
      node.lockedBy = event.lockedBy;
      node.lockExpiry = event.lockExpiry;
    }
  }

  private applyNodeUnlocked(nodes: Map<string, NodeState>, event: NodeUnlockedEvent): void {
    const node = nodes.get(event.nodeId);
    if (node) {
      node.lockedBy = undefined;
      node.lockExpiry = undefined;
    }
  }

  getNodeAtVersion(nodeId: string, events: CanvasEvent[], targetVersion: number): NodeState | null {
    let result: NodeState | null = null;
    let currentVersion = 0;

    for (const event of events) {
      if (event.type === 'NodeCreated' && (event as NodeCreatedEvent).nodeId === nodeId) {
        const nodeEvent = event as NodeCreatedEvent;
        result = {
          id: nodeEvent.nodeId,
          type: nodeEvent.nodeType,
          position: nodeEvent.position,
          content: nodeEvent.content,
          version: 1,
          createdAt: nodeEvent.timestamp,
          createdBy: nodeEvent.userId,
          updatedAt: nodeEvent.timestamp
        };
        currentVersion = 1;
      } else if (event.type === 'NodeUpdated' && (event as NodeUpdatedEvent).nodeId === nodeId) {
        const updateEvent = event as NodeUpdatedEvent;
        if (result && updateEvent.version === currentVersion + 1) {
          if (updateEvent.changes.content !== undefined) {
            result.content = updateEvent.changes.content;
          }
          if (updateEvent.changes.position !== undefined) {
            result.position = updateEvent.changes.position;
          }
          if (updateEvent.changes.style !== undefined) {
            result.style = { ...result.style, ...updateEvent.changes.style };
          }
          if (updateEvent.changes.size !== undefined) {
            result.size = updateEvent.changes.size;
          }
          if (updateEvent.changes.color !== undefined) {
            result.color = updateEvent.changes.color;
          }
          if (updateEvent.changes.shapeType !== undefined) {
            result.shapeType = updateEvent.changes.shapeType;
          }
          if (updateEvent.changes.points !== undefined) {
            result.points = updateEvent.changes.points;
          }
          if (updateEvent.changes.groupId !== undefined) {
            result.groupId = updateEvent.changes.groupId === null ? undefined : updateEvent.changes.groupId;
          }
          result.version = updateEvent.version;
          result.updatedAt = updateEvent.timestamp;
          currentVersion = updateEvent.version;
        }
      } else if (event.type === 'NodeDeleted' && (event as NodeDeletedEvent).nodeId === nodeId) {
        return null;
      }

      if (currentVersion >= targetVersion) break;
    }

    return result;
  }
}