import sqlite3 from 'sqlite3';
import { CanvasEvent } from '../events/types';
import path from 'path';
import fs from 'fs';

export class PersistenceService {
  private db: sqlite3.Database;
  private dbPath: string;

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir);
    }
    this.dbPath = path.join(dataDir, 'ligma.db');
    this.db = new sqlite3.Database(this.dbPath);
    this.init();
  }

  private init() {
    this.db.serialize(() => {
      // Table for Events
      this.db.run(`
        CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY,
          canvasId TEXT,
          userId TEXT,
          type TEXT,
          payload TEXT,
          timestamp INTEGER
        )
      `);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_events_canvasId ON events(canvasId)`);

      // Table for Tasks (to ensure they are easily queryable)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          canvasId TEXT,
          title TEXT,
          description TEXT,
          status TEXT,
          assignee TEXT,
          priority TEXT,
          timestamp INTEGER
        )
      `);

      // D: Table for Room Roles (persists across server restarts)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS room_roles (
          canvasId TEXT,
          userId TEXT,
          role TEXT,
          isOwner INTEGER DEFAULT 0,
          PRIMARY KEY (canvasId, userId)
        )
      `);
    });
  }

  async saveEvent(event: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const { id, canvasId, userId, type, timestamp, ...payload } = event;
      this.db.run(
        `INSERT INTO events (id, canvasId, userId, type, payload, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, canvasId, userId, type, JSON.stringify(payload), timestamp],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async getEvents(canvasId: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM events WHERE canvasId = ? ORDER BY timestamp ASC`,
        [canvasId],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            const events = rows.map((row: any) => ({
              id: row.id,
              canvasId: row.canvasId,
              userId: row.userId,
              type: row.type,
              timestamp: row.timestamp,
              ...JSON.parse(row.payload)
            }));
            resolve(events);
          }
        }
      );
    });
  }

  async saveTask(task: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO tasks (id, canvasId, title, description, status, assignee, priority, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [task.id, task.canvasId, task.title, task.description, task.status, task.assignee, task.priority, Date.now()],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async deleteTask(taskId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(`DELETE FROM tasks WHERE id = ?`, [taskId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getTasks(canvasId: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM tasks WHERE canvasId = ?`,
        [canvasId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  // D: Room role persistence
  async saveRoomRole(canvasId: string, userId: string, role: string, isOwner: boolean = false): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO room_roles (canvasId, userId, role, isOwner) VALUES (?, ?, ?, ?)`,
        [canvasId, userId, role, isOwner ? 1 : 0],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async getRoomRoles(canvasId: string): Promise<{ userId: string; role: string; isOwner: boolean }[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT userId, role, isOwner FROM room_roles WHERE canvasId = ?`,
        [canvasId],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows.map(row => ({
            userId: row.userId,
            role: row.role,
            isOwner: row.isOwner === 1
          })));
        }
      );
    });
  }

  async getRoomOwner(canvasId: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT userId FROM room_roles WHERE canvasId = ? AND isOwner = 1`,
        [canvasId],
        (err, row: any) => {
          if (err) reject(err);
          else resolve(row?.userId || null);
        }
      );
    });
  }

  async removeRoomUser(canvasId: string, userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `DELETE FROM room_roles WHERE canvasId = ? AND userId = ?`,
        [canvasId, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
}
