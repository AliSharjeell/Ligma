// Position CRDT with Last-Writer-Wins and Vector Clocks

import { VectorClock } from './VectorClock';

export interface PositionUpdate {
  x: number;
  y: number;
  clientId: string;
  vectorClock: Record<string, number>;
  timestamp: number;
}

export class PositionCRDT {
  private positions: Map<string, { x: number; y: number }> = new Map();
  private vectorClocks: Map<string, VectorClock> = new Map();

  setPosition(nodeId: string, x: number, y: number, clientId: string): PositionUpdate {
    const vc = this.vectorClocks.get(nodeId) || new VectorClock();
    vc.increment(clientId);

    this.positions.set(nodeId, { x, y });
    this.vectorClocks.set(nodeId, vc);

    return {
      x,
      y,
      clientId,
      vectorClock: vc.toJSON(),
      timestamp: Date.now()
    };
  }

  updatePosition(nodeId: string, x: number, y: number, clientId: string, clientVectorClock: Record<string, number>): PositionUpdate | null {
    const currentVC = this.vectorClocks.get(nodeId);
    const incomingVC = VectorClock.fromJSON(clientVectorClock);

    if (currentVC) {
      const comparison = currentVC.compare(incomingVC);
      if (comparison === 'before' || comparison === 'concurrent') {
        return null;
      }
    }

    const vc = currentVC || new VectorClock();
    vc.increment(clientId);
    vc.merge(incomingVC);

    this.positions.set(nodeId, { x, y });
    this.vectorClocks.set(nodeId, vc);

    return {
      x,
      y,
      clientId,
      vectorClock: vc.toJSON(),
      timestamp: Date.now()
    };
  }

  getPosition(nodeId: string): { x: number; y: number } | undefined {
    return this.positions.get(nodeId);
  }

  getVectorClock(nodeId: string): VectorClock | undefined {
    return this.vectorClocks.get(nodeId);
  }

  getAllPositions(): Map<string, { x: number; y: number }> {
    return new Map(this.positions);
  }

  resolveConflict(
    nodeId: string,
    localUpdate: PositionUpdate,
    remoteUpdate: PositionUpdate
  ): { x: number; y: number; winner: 'local' | 'remote' } {
    const localVC = VectorClock.fromJSON(localUpdate.vectorClock);
    const remoteVC = VectorClock.fromJSON(remoteUpdate.vectorClock);

    const comparison = localVC.compare(remoteVC);

    if (comparison === 'before') {
      return { x: remoteUpdate.x, y: remoteUpdate.y, winner: 'remote' };
    } else if (comparison === 'after') {
      return { x: localUpdate.x, y: localUpdate.y, winner: 'local' };
    }

    if (localUpdate.timestamp >= remoteUpdate.timestamp) {
      return { x: localUpdate.x, y: localUpdate.y, winner: 'local' };
    }
    return { x: remoteUpdate.x, y: remoteUpdate.y, winner: 'remote' };
  }
}