// Client-side Operational Transformation for Text Editing

export interface Operation {
  type: 'insert' | 'delete';
  position: number;
  text?: string;
  length?: number;
  clientId: string;
  nodeId: string;
  timestamp: number;
  vectorClock: Record<string, number>;
  baseVersion: number;
}

export interface TextState {
  content: string;
  version: number;
  pendingOps: Operation[];
  appliedOps: Operation[];
  vectorClock: Record<string, number>;
}

// Transform operation A against operation B
function transformOperation(opA: Operation, opB: Operation): Operation {
  const transformed = { ...opA };

  if (opA.type === 'insert' && opB.type === 'insert') {
    if (opB.position <= opA.position && opB.text) {
      transformed.position += opB.text.length;
    }
  } else if (opA.type === 'delete' && opB.type === 'insert') {
    if (opB.position < opA.position) {
      transformed.position += opB.text?.length || 0;
    }
  } else if (opA.type === 'delete' && opB.type === 'delete') {
    if (opB.position < opA.position) {
      transformed.position -= Math.min(opB.length || 0, opA.position - opB.position);
    }
    if (opB.position >= opA.position && opB.position < opA.position + (opA.length || 0)) {
      const overlapStart = opB.position - opA.position;
      const overlapEnd = Math.min((opB.length || 0) - overlapStart, (opA.length || 0) - overlapStart);
      if (opA.length && overlapEnd > 0) {
        transformed.length = opA.length - overlapEnd;
      }
    }
  } else if (opA.type === 'insert' && opB.type === 'delete') {
    if (opB.position <= opA.position) {
      const deletedBefore = Math.min(opB.length || 0, opA.position - opB.position);
      transformed.position -= deletedBefore;
    }
  }

  return transformed;
}

// Check if two operations are concurrent
function areConcurrent(opA: Operation, opB: Operation): boolean {
  const vcA = opA.vectorClock;
  const vcB = opB.vectorClock;
  let aBeforeB = false;
  let bBeforeA = false;
  const allKeys = new Set([...Object.keys(vcA), ...Object.keys(vcB)]);

  for (const key of allKeys) {
    const aVal = vcA[key] || 0;
    const bVal = vcB[key] || 0;
    if (aVal < bVal) aBeforeB = true;
    if (bVal < aVal) bBeforeA = true;
  }

  return !aBeforeB && !bBeforeA;
}

// Apply operation to text
function applyOperation(text: string, op: Operation): string {
  switch (op.type) {
    case 'insert':
      const pos = Math.min(Math.max(0, op.position), text.length);
      return text.slice(0, pos) + (op.text || '') + text.slice(pos);
    case 'delete':
      const start = Math.min(Math.max(0, op.position), text.length);
      const len = Math.min(op.length || 1, text.length - start);
      return text.slice(0, start) + text.slice(start + len);
    default:
      return text;
  }
}

export class ClientOT {
  private nodeId: string;
  private state: TextState;
  private clientId: string;
  private pendingOps: Operation[] = [];
  private acknowledgedOps: Operation[] = [];
  private history: TextState[] = [];
  private maxHistorySize = 50;

  constructor(nodeId: string, clientId: string, initialContent = '') {
    this.nodeId = nodeId;
    this.clientId = clientId;
    this.state = {
      content: initialContent,
      version: 0,
      pendingOps: [],
      appliedOps: [],
      vectorClock: {}
    };
  }

  getContent(): string {
    return this.state.content;
  }

  getVersion(): number {
    return this.state.version;
  }

  // Local insert operation
  insert(position: number, text: string): Operation {
    this.saveToHistory();

    const op: Operation = {
      type: 'insert',
      position,
      text,
      clientId: this.clientId,
      nodeId: this.nodeId,
      timestamp: Date.now(),
      vectorClock: { ...this.state.vectorClock },
      baseVersion: this.state.version
    };

    // Apply locally
    this.state.content = applyOperation(this.state.content, op);
    this.incrementClock(this.clientId);
    op.vectorClock = { ...this.state.vectorClock };

    this.state.version++;
    this.state.pendingOps.push(op);
    this.pendingOps.push(op);
    this.state.appliedOps.push(op);

    return op;
  }

  // Local delete operation
  delete(position: number, length: number): Operation {
    this.saveToHistory();

    const op: Operation = {
      type: 'delete',
      position,
      length,
      clientId: this.clientId,
      nodeId: this.nodeId,
      timestamp: Date.now(),
      vectorClock: { ...this.state.vectorClock },
      baseVersion: this.state.version
    };

    this.state.content = applyOperation(this.state.content, op);
    this.incrementClock(this.clientId);
    op.vectorClock = { ...this.state.vectorClock };

    this.state.version++;
    this.state.pendingOps.push(op);
    this.pendingOps.push(op);
    this.state.appliedOps.push(op);

    return op;
  }

  // Apply remote operation
  applyRemote(remoteOp: Operation): { transformed: boolean; content: string } {
    // Check if already applied
    const alreadyApplied = this.state.appliedOps.some(
      op => op.clientId === remoteOp.clientId && op.timestamp === remoteOp.timestamp
    );

    if (alreadyApplied) {
      return { transformed: false, content: this.state.content };
    }

    // Transform against pending local ops
    let transformedOp = remoteOp;
    let transformed = false;

    for (const localOp of this.pendingOps) {
      if (areConcurrent(localOp, remoteOp)) {
        transformedOp = transformOperation(transformedOp, localOp);
        transformed = true;
      }
    }

    // Apply
    this.state.content = applyOperation(this.state.content, transformedOp);
    this.mergeClock(remoteOp.vectorClock);
    this.state.appliedOps.push(transformedOp);

    return { transformed, content: this.state.content };
  }

  // Handle acknowledgment from server
  acknowledge(op: Operation): void {
    this.pendingOps = this.pendingOps.filter(
      p => !(p.clientId === op.clientId && p.timestamp === op.timestamp)
    );
  }

  // Handle server state for reconciliation
  reconcile(serverContent: string, serverVersion: number, serverOps: Operation[]): void {
    // Transform pending ops against server ops
    const transformedPending: Operation[] = [];

    for (const localOp of this.pendingOps) {
      let op = localOp;
      for (const serverOp of serverOps) {
        if (areConcurrent(op, serverOp)) {
          op = transformOperation(op, serverOp);
        }
      }
      transformedPending.push(op);
    }

    this.state = {
      content: serverContent,
      version: serverVersion,
      pendingOps: transformedPending,
      appliedOps: [...serverOps],
      vectorClock: { ...this.state.vectorClock }
    };

    // Reapply transformed pending
    for (const op of this.state.pendingOps) {
      this.state.content = applyOperation(this.state.content, op);
    }
  }

  getPending(): Operation[] {
    return [...this.pendingOps];
  }

  getState(): TextState {
    return {
      content: this.state.content,
      version: this.state.version,
      pendingOps: [...this.state.pendingOps],
      appliedOps: [...this.state.appliedOps],
      vectorClock: { ...this.state.vectorClock }
    };
  }

  private incrementClock(clientId: string): void {
    this.state.vectorClock[clientId] = (this.state.vectorClock[clientId] || 0) + 1;
  }

  private mergeClock(clock: Record<string, number>): void {
    for (const [key, val] of Object.entries(clock)) {
      this.state.vectorClock[key] = Math.max(this.state.vectorClock[key] || 0, val);
    }
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

// Client OT Manager
export class ClientOTManager {
  private documents: Map<string, ClientOT> = new Map();

  createDocument(nodeId: string, clientId: string, initialContent = ''): ClientOT {
    const doc = new ClientOT(nodeId, clientId, initialContent);
    this.documents.set(nodeId, doc);
    return doc;
  }

  getDocument(nodeId: string): ClientOT | undefined {
    return this.documents.get(nodeId);
  }

  hasDocument(nodeId: string): boolean {
    return this.documents.has(nodeId);
  }

  deleteDocument(nodeId: string): boolean {
    return this.documents.delete(nodeId);
  }
}