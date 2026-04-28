import { CanvasEvent } from '../events/types';
import path from 'path';
import fs from 'fs';

interface DataStore {
  events: Record<string, any[]>;
  tasks: Record<string, any[]>;
  roomRoles: Record<string, Record<string, { role: string; isOwner: boolean }>>;
}

export class PersistenceService {
  private dataPath: string;
  private data: DataStore;

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dataPath = path.join(dataDir, 'ligma-data.json');
    this.data = this.load();
  }

  private load(): DataStore {
    try {
      if (fs.existsSync(this.dataPath)) {
        const content = fs.readFileSync(this.dataPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (e) {
      console.error('Error loading data file:', e);
    }
    return {
      events: {},
      tasks: {},
      roomRoles: {}
    };
  }

  private save(): void {
    try {
      fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error('Error saving data file:', e);
    }
  }

  async saveEvent(event: any): Promise<void> {
    const { canvasId } = event;
    if (!this.data.events[canvasId]) {
      this.data.events[canvasId] = [];
    }
    this.data.events[canvasId].push(event);
    this.save();
  }

  async getEvents(canvasId: string): Promise<any[]> {
    return this.data.events[canvasId] || [];
  }

  async saveTask(task: any): Promise<void> {
    const { canvasId } = task;
    if (!this.data.tasks[canvasId]) {
      this.data.tasks[canvasId] = [];
    }
    const index = this.data.tasks[canvasId].findIndex(t => t.id === task.id);
    if (index >= 0) {
      this.data.tasks[canvasId][index] = task;
    } else {
      this.data.tasks[canvasId].push(task);
    }
    this.save();
  }

  async deleteTask(taskId: string): Promise<void> {
    for (const canvasId of Object.keys(this.data.tasks)) {
      this.data.tasks[canvasId] = this.data.tasks[canvasId].filter(t => t.id !== taskId);
    }
    this.save();
  }

  async getTasks(canvasId: string): Promise<any[]> {
    return this.data.tasks[canvasId] || [];
  }

  async saveRoomRole(canvasId: string, userId: string, role: string, isOwner: boolean = false): Promise<void> {
    if (!this.data.roomRoles[canvasId]) {
      this.data.roomRoles[canvasId] = {};
    }
    this.data.roomRoles[canvasId][userId] = { role, isOwner };
    this.save();
  }

  async getRoomRoles(canvasId: string): Promise<{ userId: string; role: string; isOwner: boolean }[]> {
    const roles = this.data.roomRoles[canvasId] || {};
    return Object.entries(roles).map(([userId, data]) => ({
      userId,
      ...data
    }));
  }

  async getRoomOwner(canvasId: string): Promise<string | null> {
    const roles = this.data.roomRoles[canvasId] || {};
    for (const [userId, data] of Object.entries(roles)) {
      if (data.isOwner) return userId;
    }
    return null;
  }

  async removeRoomUser(canvasId: string, userId: string): Promise<void> {
    if (this.data.roomRoles[canvasId]) {
      delete this.data.roomRoles[canvasId][userId];
      this.save();
    }
  }
}
