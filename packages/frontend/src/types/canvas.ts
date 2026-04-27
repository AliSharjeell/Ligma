export type ElementType = 'sticky' | 'shape' | 'text' | 'drawing';
export type ShapeType = 'rectangle' | 'circle';
export type Tool = 'select' | 'sticky' | 'shape' | 'text' | 'draw' | 'pan';

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface CanvasElement {
  id: string;
  type: ElementType;
  position: Position;
  size: Size;
  content: string;
  color?: string;
  shapeType?: ShapeType;
  points?: Position[];
  locked: boolean;
  lockedBy?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface User {
  id: string;
  name: string;
  color: string;
  cursor?: Position;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed';
  assignee?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface CanvasState {
  elements: Map<string, CanvasElement>;
  selectedId: string | null;
  tool: Tool;
  shapeType: ShapeType;
  users: Map<string, User>;
  tasks: Task[];
  eventLog: CanvasEvent[];
  viewportPosition: Position;
  viewportZoom: number;
  userId: string;
  userName: string;
}

export interface CanvasEvent {
  id: string;
  type: 'create' | 'update' | 'delete' | 'lock' | 'unlock' | 'cursor';
  elementId?: string;
  userId: string;
  userName: string;
  timestamp: number;
  details?: string;
}

export interface SocketEvents {
  'element:create': CanvasElement;
  'element:update': CanvasElement;
  'element:delete': string;
  'element:lock': { elementId: string; userId: string };
  'element:unlock': string;
  'cursor:move': { userId: string; position: Position };
  'user:join': User;
  'user:leave': string;
}