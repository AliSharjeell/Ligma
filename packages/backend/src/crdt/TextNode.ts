// CRDT Text Node - Yjs-like implementation

import { VectorClock } from './VectorClock';

export interface TextOperation {
  id: string;
  type: 'insert' | 'delete';
  position: number;
  text?: string;
  length?: number;
  vectorClock: Record<string, number>;
  clientId: string;
  timestamp: number;
}

export interface TextNodeState {
  content: string;
  operations: TextOperation[];
  vectorClock: VectorClock;
}

export class CRDTTextNode {
  private state: TextNodeState;
  private clientId: string;
  private pendingOps: TextOperation[] = [];

  constructor(clientId: string, initialContent = '') {
    this.clientId = clientId;
    this.state = {
      content: initialContent,
      operations: [],
      vectorClock: new VectorClock()
    };
  }

  insert(position: number, text: string): TextOperation {
    const op: TextOperation = {
      id: `${this.clientId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'insert',
      position,
      text,
      vectorClock: this.state.vectorClock.toJSON(),
      clientId: this.clientId,
      timestamp: Date.now()
    };

    this.pendingOps.push(op);
    this.state.vectorClock.increment(this.clientId);
    return op;
  }

  delete(position: number, length: number): TextOperation {
    const op: TextOperation = {
      id: `${this.clientId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'delete',
      position,
      length,
      vectorClock: this.state.vectorClock.toJSON(),
      clientId: this.clientId,
      timestamp: Date.now()
    };

    this.pendingOps.push(op);
    this.state.vectorClock.increment(this.clientId);
    return op;
  }

  applyRemote(op: TextOperation): void {
    const remoteVC = VectorClock.fromJSON(op.vectorClock);
    const comparison = this.state.vectorClock.compare(remoteVC);

    if (comparison === 'before') {
      return;
    }

    const existingOp = this.state.operations.find(o => o.id === op.id);
    if (existingOp) {
      return;
    }

    if (op.type === 'insert' && op.text) {
      this.applyInsert(op.position, op.text);
    } else if (op.type === 'delete' && op.length) {
      this.applyDelete(op.position, op.length);
    }

    this.state.operations.push(op);
    this.state.vectorClock.merge(remoteVC);
  }

  private applyInsert(position: number, text: string): void {
    const actualPos = Math.min(Math.max(0, position), this.state.content.length);
    this.state.content =
      this.state.content.slice(0, actualPos) +
      text +
      this.state.content.slice(actualPos);
  }

  private applyDelete(position: number, length: number): void {
    const actualPos = Math.min(Math.max(0, position), this.state.content.length);
    const actualLength = Math.min(length, this.state.content.length - actualPos);
    this.state.content =
      this.state.content.slice(0, actualPos) +
      this.state.content.slice(actualPos + actualLength);
  }

  getContent(): string {
    return this.state.content;
  }

  getPending(): TextOperation[] {
    return [...this.pendingOps];
  }

  clearPending(): void {
    this.pendingOps = [];
  }

  getState(): TextNodeState {
    return {
      content: this.state.content,
      operations: [...this.state.operations],
      vectorClock: this.state.vectorClock.clone()
    };
  }

  getVectorClock(): VectorClock {
    return this.state.vectorClock.clone();
  }
}

export function mergeTextNodes(local: CRDTTextNode, remote: CRDTTextNode): string {
  const localOps = local.getPending();
  const remoteState = remote.getState();

  for (const op of remoteState.operations) {
    if (!localOps.find(o => o.id === op.id)) {
      local.applyRemote(op);
    }
  }

  return local.getContent();
}