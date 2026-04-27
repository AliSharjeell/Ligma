// CRDT Manager - Conflict Resolution for Concurrent Edits

import { v4 as uuidv4 } from 'uuid';

export interface VectorClock {
  [clientId: string]: number;
}

export interface CRDTTextOperation {
  type: 'insert' | 'delete';
  position: number;
  character?: string;
  length?: number;
  clientId: string;
  vectorClock: VectorClock;
}

export interface CRDTNode {
  nodeId: string;
  text: string;
  operations: CRDTTextOperation[];
  vectorClock: VectorClock;
  lastWriter: string;
}

export class CRDTManager {
  private nodes: Map<string, CRDTNode> = new Map();

  createNode(nodeId: string): CRDTNode {
    const node: CRDTNode = {
      nodeId,
      text: '',
      operations: [],
      vectorClock: {},
      lastWriter: ''
    };
    this.nodes.set(nodeId, node);
    return node;
  }

  getNode(nodeId: string): CRDTNode | undefined {
    return this.nodes.get(nodeId);
  }

  applyOperation(
    nodeId: string,
    operation: CRDTTextOperation
  ): { success: boolean; mergedText: string } {
    let node = this.nodes.get(nodeId);

    if (!node) {
      node = this.createNode(nodeId);
    }

    // Update vector clock
    node.vectorClock[operation.clientId] =
      (node.vectorClock[operation.clientId] || 0) + 1;

    // Check for conflicts using vector clock comparison
    const hasConflict = this.detectConflict(node.vectorClock, operation.vectorClock);

    if (hasConflict) {
      // Store operation for later merge
      node.operations.push(operation);
      // Apply operation optimistically (last-write-wins for position)
      node.text = this.applyToText(node.text, operation);
    } else {
      // No conflict, apply directly
      node.operations.push(operation);
      node.text = this.applyToText(node.text, operation);
    }

    node.lastWriter = operation.clientId;
    node.vectorClock = this.mergeVectorClocks(node.vectorClock, operation.vectorClock);

    return { success: true, mergedText: node.text };
  }

  private detectConflict(local: VectorClock, remote: VectorClock): boolean {
    // If neither clock dominates the other, there's a conflict
    const localDomRemote = this.clockDominates(local, remote);
    const remoteDomLocal = this.clockDominates(remote, local);
    return !localDomRemote && !remoteDomLocal;
  }

  private clockDominates(a: VectorClock, b: VectorClock): boolean {
    let dominated = false;
    for (const [clientId, aClock] of Object.entries(a)) {
      const bClock = b[clientId] || 0;
      if (aClock > bClock) {
        dominated = true;
      } else if (aClock < bClock) {
        return false;
      }
    }
    return dominated;
  }

  private mergeVectorClocks(a: VectorClock, b: VectorClock): VectorClock {
    const merged: VectorClock = { ...a };
    for (const [clientId, clock] of Object.entries(b)) {
      merged[clientId] = Math.max(merged[clientId] || 0, clock);
    }
    return merged;
  }

  private applyToText(text: string, op: CRDTTextOperation): string {
    switch (op.type) {
      case 'insert':
        const char = op.character || '';
        const pos = Math.min(Math.max(0, op.position), text.length);
        return text.slice(0, pos) + char + text.slice(pos);
      case 'delete':
        const len = op.length || 1;
        const start = Math.min(Math.max(0, op.position), text.length);
        return text.slice(0, start) + text.slice(start + len);
      default:
        return text;
    }
  }

  mergeOperations(nodeId: string): string {
    const node = this.nodes.get(nodeId);
    if (!node) return '';

    // Sort operations by vector clock for deterministic merge
    const sortedOps = [...node.operations].sort((a, b) => {
      return this.compareVectorClocks(a.vectorClock, b.vectorClock);
    });

    // Replay operations in order
    let mergedText = '';
    for (const op of sortedOps) {
      mergedText = this.applyToText(mergedText, op);
    }

    node.text = mergedText;
    return mergedText;
  }

  private compareVectorClocks(a: VectorClock, b: VectorClock): number {
    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of allKeys) {
      const aClock = a[key] || 0;
      const bClock = b[key] || 0;
      if (aClock !== bClock) {
        return aClock - bClock;
      }
    }
    return 0;
  }

  // Position-based last-writer-wins for non-text properties
  mergePosition(
    local: { position: { x: number; y: number }; timestamp: number },
    remote: { position: { x: number; y: number }; timestamp: number }
  ): { x: number; y: number } {
    // Last writer wins based on timestamp
    if (remote.timestamp > local.timestamp) {
      return remote.position;
    }
    return local.position;
  }
}

export const crdtManager = new CRDTManager();
