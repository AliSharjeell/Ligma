export type ElementType = 'sticky' | 'shape' | 'text' | 'drawing' | 'image';
export type ShapeType = 'rectangle' | 'circle';
export type Tool = 'select' | 'sticky' | 'shape' | 'text' | 'draw' | 'pan' | 'eraser';

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
  textStyle?: {
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: 'normal' | 'bold' | number;
    textAlign?: 'left' | 'center' | 'right';
  };
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
  selectedIds: Set<string>;
  tool: Tool;
  shapeType: ShapeType;
  drawColor: string;
  shapeColor: string;
  stickyColor: string;
  textColor: string;
  textFontSize: number;
  textFontFamily: string;
  textFontWeight: 'normal' | 'bold' | number;
  textAlign: 'left' | 'center' | 'right';
  presenceHeatmapEnabled: boolean;
  presenceZonesEnabled: boolean;
  timeTravelEnabled: boolean;
  users: Map<string, User>;
  tasks: Task[];
  eventLog: CanvasEvent[];
  viewportPosition: Position;
  viewportZoom: number;
  userId: string;
  userName: string;
  history: { elements: Map<string, CanvasElement>; timestamp: number }[];
  redoStack: { elements: Map<string, CanvasElement>; timestamp: number }[];
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
  create_node: CanvasElement;
  update_node: CanvasElement;
  delete_node: string;
  lock_node: { elementId: string; userId: string };
  unlock_node: string;
  cursor_move: { userId: string; position: Position };
  user_joined: User;
  user_left: string;
}