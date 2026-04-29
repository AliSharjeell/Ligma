// Event Types for LIMA Event-Sourced Architecture

export type EventType =
  | 'NodeCreated'
  | 'NodeUpdated'
  | 'NodeDeleted'
  | 'NodeLocked'
  | 'NodeUnlocked'
  | 'CursorMoved'
  | 'UserJoined'
  | 'UserLeft'
  | 'RoleChanged';

export interface BaseEvent {
  id: string;
  type: EventType;
  canvasId: string;
  userId: string;
  timestamp: number;
  vectorClock: Record<string, number>;
}

export interface NodeCreatedEvent extends BaseEvent {
  type: 'NodeCreated';
  nodeId: string;
  nodeType: 'text' | 'shape' | 'image' | 'sticky' | 'drawing';
  position: { x: number; y: number };
  content: string;
  metadata?: Record<string, unknown>;
}

export interface NodeUpdatedEvent extends BaseEvent {
  type: 'NodeUpdated';
  nodeId: string;
  changes: Partial<{
    content: string;
    position: { x: number; y: number };
    style: Record<string, unknown>;
    size: { width: number; height: number };
    color: string;
    shapeType: 'rectangle' | 'circle';
    points: { x: number; y: number }[];
  }>;
  version: number;
  causallyDependsOn: string[];
}

export interface NodeDeletedEvent extends BaseEvent {
  type: 'NodeDeleted';
  nodeId: string;
}

export interface NodeLockedEvent extends BaseEvent {
  type: 'NodeLocked';
  nodeId: string;
  lockedBy: string;
  lockExpiry?: number;
}

export interface NodeUnlockedEvent extends BaseEvent {
  type: 'NodeUnlocked';
  nodeId: string;
}

export interface CursorMovedEvent extends BaseEvent {
  type: 'CursorMoved';
  userId: string;
  position: { x: number; y: number };
  canvasId: string;
}

export interface UserJoinedEvent extends BaseEvent {
  type: 'UserJoined';
  userId: string;
  userName: string;
  role: 'Lead' | 'Contributor' | 'Viewer';
}

export interface UserLeftEvent extends BaseEvent {
  type: 'UserLeft';
  userId: string;
}

export interface RoleChangedEvent extends BaseEvent {
  type: 'RoleChanged';
  userId: string;
  oldRole: 'Lead' | 'Contributor' | 'Viewer';
  newRole: 'Lead' | 'Contributor' | 'Viewer';
}

export type CanvasEvent =
  | NodeCreatedEvent
  | NodeUpdatedEvent
  | NodeDeletedEvent
  | NodeLockedEvent
  | NodeUnlockedEvent
  | CursorMovedEvent
  | UserJoinedEvent
  | UserLeftEvent
  | RoleChangedEvent;

export interface NodeState {
  id: string;
  type: 'text' | 'shape' | 'image' | 'sticky' | 'drawing';
  position: { x: number; y: number };
  content: string;
  size?: { width: number; height: number };
  color?: string;
  shapeType?: 'rectangle' | 'circle';
  points?: { x: number; y: number }[];
  style?: Record<string, unknown>;
  version: number;
  lockedBy?: string;
  lockExpiry?: number;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  groupId?: string;
}

export interface CanvasState {
  canvasId: string;
  nodes: Map<string, NodeState>;
  lastEventId: string;
  vectorClock: Record<string, number>;
}