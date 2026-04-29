// Operational Transformation for Text Editing
// Handles concurrent edits with proper transformation to maintain consistency

import { v4 as uuidv4 } from 'uuid';

export type OperationType = 'insert' | 'delete' | 'retain';

export interface Operation {
  type: OperationType;
  position: number;
  text?: string;     // For insert
  length?: number;   // For delete/retain
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
// Returns transformed A that can be applied after B
export function transformOperation(opA: Operation, opB: Operation): Operation {
  const transformed = { ...opA };

  if (opA.type === 'insert' && opB.type === 'insert') {
    // Both inserting - shift position if B inserted before A
    if (opB.position <= opA.position && opB.text) {
      transformed.position += opB.text.length;
    }
  } else if (opA.type === 'delete' && opB.type === 'insert') {
    // A deleting, B inserting - shift if B inserted before A's delete position
    if (opB.position < opA.position) {
      transformed.position += (opB.text?.length || 0);
    }
  } else if (opA.type === 'delete' && opB.type === 'delete') {
    // Both deleting - complex transformation
    if (opB.position < opA.position) {
      transformed.position -= Math.min(opB.length || 0, opA.position - opB.position);
    }
    if (opB.position >= opA.position && opB.position < opA.position + (opA.length || 0)) {
      // Overlapping deletes
      const overlapStart = opB.position - opA.position;
      const overlapEnd = Math.min(
        (opB.length || 0) - overlapStart,
        (opA.length || 0) - overlapStart
      );
      if (opA.length && overlapEnd > 0) {
        transformed.length = opA.length - overlapEnd;
      }
    }
  } else if (opA.type === 'insert' && opB.type === 'delete') {
    // A inserting, B deleting - shift if B deleted before A's position
    if (opB.position <= opA.position) {
      const deletedBefore = Math.min(opB.length || 0, opA.position - opB.position);
      transformed.position -= deletedBefore;
    }
  }

  return transformed;
}

// Check if two operations are concurrent (neither causally depends on the other)
export function areConcurrent(opA: Operation, opB: Operation): boolean {
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

// Sort operations by vector clock (deterministic ordering)
export function sortOperations(ops: Operation[]): Operation[] {
  return [...ops].sort((a, b) => {
    const vcA = a.vectorClock;
    const vcB = b.vectorClock;
    const allKeys = new Set([...Object.keys(vcA), ...Object.keys(vcB)]);

    for (const key of allKeys) {
      const aVal = vcA[key] || 0;
      const bVal = vcB[key] || 0;
      if (aVal !== bVal) return aVal - bVal;
    }
    return 0;
  });
}

// Apply operation to text content
export function applyOperation(text: string, op: Operation): string {
  switch (op.type) {
    case 'insert':
      const pos = Math.min(Math.max(0, op.position), text.length);
      return text.slice(0, pos) + (op.text || '') + text.slice(pos);

    case 'delete':
      const start = Math.min(Math.max(0, op.position), text.length);
      const len = Math.min(op.length || 1, text.length - start);
      return text.slice(0, start) + text.slice(start + len);

    case 'retain':
      return text;

    default:
      return text;
  }
}

// Transform a list of operations against another list
export function transformAll(
  localOps: Operation[],
  remoteOps: Operation[]
): Operation[] {
  const transformed = [...localOps];

  for (const remote of remoteOps) {
    for (let i = 0; i < transformed.length; i++) {
      if (transformed[i].timestamp > remote.timestamp) {
        // Local op happened after remote, need to transform
        transformed[i] = transformOperation(transformed[i], remote);
      }
    }
  }

  return transformed;
}

// Create an insert operation
export function createInsert(
  nodeId: string,
  position: number,
  text: string,
  clientId: string,
  baseVersion: number
): Operation {
  return {
    type: 'insert',
    position,
    text,
    clientId,
    nodeId,
    timestamp: Date.now(),
    vectorClock: {},
    baseVersion
  };
}

// Create a delete operation
export function createDelete(
  nodeId: string,
  position: number,
  length: number,
  clientId: string,
  baseVersion: number
): Operation {
  return {
    type: 'delete',
    position,
    length,
    clientId,
    nodeId,
    timestamp: Date.now(),
    vectorClock: {},
    baseVersion
  };
}

// Update vector clock with operation
export function incrementClock(
  clock: Record<string, number>,
  clientId: string
): Record<string, number> {
  return {
    ...clock,
    [clientId]: (clock[clientId] || 0) + 1
  };
}

// Merge two vector clocks
export function mergeClock(
  a: Record<string, number>,
  b: Record<string, number>
): Record<string, number> {
  const merged: Record<string, number> = { ...a };
  for (const [key, val] of Object.entries(b)) {
    merged[key] = Math.max(merged[key] || 0, val);
  }
  return merged;
}