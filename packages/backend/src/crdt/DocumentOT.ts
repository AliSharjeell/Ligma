// Document OT - Manages OT state for a single document (text node)

import {
  Operation,
  TextState,
  createInsert,
  createDelete,
  transformOperation,
  applyOperation,
  incrementClock,
  mergeClock,
  sortOperations,
  areConcurrent
} from './OperationalTransform';
import { VectorClock } from './VectorClock';

export interface DocumentOTConfig {
  nodeId: string;
  initialContent?: string;
  clientId: string;
}

export class DocumentOT {
  private nodeId: string;
  private state: TextState;
  private history: TextState[] = [];
  private maxHistorySize = 50;
  private clientId: string;

  constructor(config: DocumentOTConfig) {
    this.nodeId = config.nodeId;
    this.clientId = config.clientId;
    this.state = {
      content: config.initialContent || '',
      version: 0,
      pendingOps: [],
      appliedOps: [],
      vectorClock: {}
    };
  }

  // Get current content
  getContent(): string {
    return this.state.content;
  }

  // Get current version
  getVersion(): number {
    return this.state.version;
  }

  // Get vector clock
  getVectorClock(): Record<string, number> {
    return { ...this.state.vectorClock };
  }

  // Create a local insert operation
  insert(position: number, text: string): Operation {
    // Save current state to history for undo
    this.saveToHistory();

    const op = createInsert(
      this.nodeId,
      position,
      text,
      this.clientId,
      this.state.version
    );

    // Apply locally immediately
    this.state.content = applyOperation(this.state.content, op);
    op.vectorClock = incrementClock(this.state.vectorClock, this.clientId);
    op.baseVersion = this.state.version;

    this.state.version++;
    this.state.pendingOps.push(op);
    this.state.appliedOps.push(op);

    return op;
  }

  // Create a local delete operation
  delete(position: number, length: number): Operation {
    this.saveToHistory();

    const op = createDelete(
      this.nodeId,
      position,
      length,
      this.clientId,
      this.state.version
    );

    this.state.content = applyOperation(this.state.content, op);
    op.vectorClock = incrementClock(this.state.vectorClock, this.clientId);
    op.baseVersion = this.state.version;

    this.state.version++;
    this.state.pendingOps.push(op);
    this.state.appliedOps.push(op);

    return op;
  }

  // Apply remote operation and transform if needed
  applyRemote(remoteOp: Operation): { transformed: boolean; content: string } {
    // Check if this operation has already been applied
    const alreadyApplied = this.state.appliedOps.some(
      op => op.clientId === remoteOp.clientId &&
            op.timestamp === remoteOp.timestamp
    );

    if (alreadyApplied) {
      return { transformed: false, content: this.state.content };
    }

    // Check for concurrent operations that need transformation
    let transformedOp = remoteOp;
    let transformed = false;

    for (const localOp of this.state.pendingOps) {
      if (areConcurrent(localOp, remoteOp)) {
        transformedOp = transformOperation(transformedOp, localOp);
        transformed = true;
      }
    }

    // Apply the transformed operation
    this.state.content = applyOperation(this.state.content, transformedOp);
    this.state.vectorClock = mergeClock(this.state.vectorClock, transformedOp.vectorClock);
    this.state.appliedOps.push(transformedOp);

    return { transformed, content: this.state.content };
  }

  // Merge multiple remote operations
  mergeRemote(ops: Operation[]): string {
    const sorted = sortOperations(ops);

    for (const op of sorted) {
      const result = this.applyRemote(op);
      this.state.content = result.content;
    }

    return this.state.content;
  }

  // Sync state from server (on reconnect)
  syncFromServer(serverState: TextState): void {
    // Transform any pending local operations against server state
    const transformedPending: Operation[] = [];

    for (const localOp of this.state.pendingOps) {
      let op = localOp;
      for (const serverOp of serverState.appliedOps) {
        if (areConcurrent(op, serverOp)) {
          op = transformOperation(op, serverOp);
        }
      }
      transformedPending.push(op);
    }

    this.state = {
      content: serverState.content,
      version: serverState.version,
      pendingOps: transformedPending,
      appliedOps: [...serverState.appliedOps],
      vectorClock: { ...serverState.vectorClock }
    };

    // Reapply transformed pending ops
    for (const op of this.state.pendingOps) {
      this.state.content = applyOperation(this.state.content, op);
    }
  }

  // Get pending operations for sending to server
  getPending(): Operation[] {
    return [...this.state.pendingOps];
  }

  // Clear pending operations after they're acknowledged
  clearPending(acknowledged: Operation[]): void {
    const ackIds = new Set(
      acknowledged.map(op => `${op.clientId}-${op.timestamp}`)
    );

    this.state.pendingOps = this.state.pendingOps.filter(op => {
      const id = `${op.clientId}-${op.timestamp}`;
      return !ackIds.has(id);
    });
  }

  // Undo last local operation
  undo(): Operation | null {
    if (this.history.length === 0) return null;

    // Pop the last state
    const lastState = this.history.pop();
    if (!lastState) return null;

    // Find the last operation we applied
    const lastOp = this.state.pendingOps.find(
      op => op.clientId === this.clientId
    );

    if (lastOp) {
      // Create inverse operation (undo)
      let undoOp: Operation;
      if (lastOp.type === 'insert') {
        undoOp = createDelete(
          this.nodeId,
          lastOp.position,
          lastOp.text?.length || 0,
          this.clientId,
          this.state.version
        );
      } else {
        // For delete, we'd need to know what was deleted
        // This is a simplification - real OT would track deleted content
        undoOp = createInsert(
          this.nodeId,
          lastOp.position,
          lastOp.text || '',
          this.clientId,
          this.state.version
        );
      }

      this.state.content = applyOperation(this.state.content, undoOp);
      return undoOp;
    }

    this.state = lastState;
    return null;
  }

  // Get current state for serialization
  getState(): TextState {
    return {
      content: this.state.content,
      version: this.state.version,
      pendingOps: [...this.state.pendingOps],
      appliedOps: [...this.state.appliedOps],
      vectorClock: { ...this.state.vectorClock }
    };
  }

  private saveToHistory(): void {
    this.history.push({
      content: this.state.content,
      version: this.state.version,
      pendingOps: [...this.state.pendingOps],
      appliedOps: [...this.state.appliedOps],
      vectorClock: { ...this.state.vectorClock }
    });

    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }
}

// OT Manager - manages multiple DocumentOT instances
export class OTManager {
  private documents: Map<string, DocumentOT> = new Map();

  createDocument(
    nodeId: string,
    clientId: string,
    initialContent = ''
  ): DocumentOT {
    const doc = new DocumentOT({
      nodeId,
      clientId,
      initialContent
    });
    this.documents.set(nodeId, doc);
    return doc;
  }

  getDocument(nodeId: string): DocumentOT | undefined {
    return this.documents.get(nodeId);
  }

  hasDocument(nodeId: string): boolean {
    return this.documents.has(nodeId);
  }

  deleteDocument(nodeId: string): boolean {
    return this.documents.delete(nodeId);
  }

  getAllDocuments(): Map<string, DocumentOT> {
    return new Map(this.documents);
  }
}

// Export singleton for easy use
export const otManager = new OTManager();