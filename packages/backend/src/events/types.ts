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
  | 'RoleChanged'
  | 'GroupCreated'
  | 'GroupDeleted'
  | 'GroupOwnerAdded'
  | 'GroupOwnerRemoved';

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

export type IntentType = 'action_item' | 'decision' | 'open_question' | 'reference';

export interface IntentTag {
  type: IntentType;
  confidence: number;
  keywords: string[];
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
    groupId?: string | null;
    intentTag: IntentTag;
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

export interface GroupCreatedEvent extends BaseEvent {
  type: 'GroupCreated';
  groupId: string;
  nodeIds: string[];
}

export interface GroupDeletedEvent extends BaseEvent {
  type: 'GroupDeleted';
  groupId: string;
}

export interface GroupOwnerAddedEvent extends BaseEvent {
  type: 'GroupOwnerAdded';
  groupId: string;
  targetUserId: string;
}

export interface GroupOwnerRemovedEvent extends BaseEvent {
  type: 'GroupOwnerRemoved';
  groupId: string;
  targetUserId: string;
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
  | RoleChangedEvent
  | GroupCreatedEvent
  | GroupDeletedEvent
  | GroupOwnerAddedEvent
  | GroupOwnerRemovedEvent;

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
  groupOwnerId?: string; // Creator of the group
}

export interface GroupState {
  id: string;
  canvasId: string;
  nodeIds: string[];
  ownerId: string; // Primary owner (creator)
  coOwners: string[]; // Additional owners promoted by primary owner
  createdAt: number;
  createdBy: string;
}

export interface CanvasState {
  canvasId: string;
  nodes: Map<string, NodeState>;
  lastEventId: string;
  vectorClock: Record<string, number>;
}