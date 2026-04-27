// Vector Clock Implementation for CRDT

export class VectorClock {
  private clock: Record<string, number> = {};

  increment(clientId: string): VectorClock {
    this.clock[clientId] = (this.clock[clientId] || 0) + 1;
    return this;
  }

  get(clientId: string): number {
    return this.clock[clientId] || 0;
  }

  merge(other: VectorClock): VectorClock {
    const otherClock = other.toJSON();
    for (const [id, value] of Object.entries(otherClock)) {
      this.clock[id] = Math.max(this.clock[id] || 0, value);
    }
    return this;
  }

  compare(other: VectorClock): 'before' | 'after' | 'concurrent' {
    const otherClock = other.toJSON();
    let hasBefore = false;
    let hasAfter = false;

    const allKeys = new Set([...Object.keys(this.clock), ...Object.keys(otherClock)]);

    for (const key of allKeys) {
      const thisVal = this.clock[key] || 0;
      const otherVal = otherClock[key] || 0;

      if (thisVal < otherVal) hasBefore = true;
      if (thisVal > otherVal) hasAfter = true;
    }

    if (hasBefore && hasAfter) return 'concurrent';
    if (hasBefore) return 'before';
    if (hasAfter) return 'after';
    return 'concurrent';
  }

  toJSON(): Record<string, number> {
    return { ...this.clock };
  }

  clone(): VectorClock {
    const vc = new VectorClock();
    vc.clock = { ...this.clock };
    return vc;
  }

  static fromJSON(data: Record<string, number>): VectorClock {
    const vc = new VectorClock();
    vc.clock = { ...data };
    return vc;
  }
}