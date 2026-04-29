export type ElementType = 'sticky' | 'shape' | 'text' | 'drawing' | 'image' | 'comment';
export type ShapeType = 'rectangle' | 'circle' | 'arrow' | 'line' | 'triangle' | 'diamond' | 'hexagon' | 'star';
export type Tool = 'select' | 'sticky' | 'shape' | 'text' | 'draw' | 'pan' | 'eraser' | 'comment';
export type IntentType = 'action_item' | 'decision' | 'open_question' | 'reference';

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface IntentTag {
  type: IntentType;
  confidence: number;
  keywords: string[];
}

export interface CanvasElement {
  id: string;
  type: ElementType;
  position: Position;
  size: Size;
  content: string;
  color?: string;
  strokeWidth?: number;
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
  groupId?: string;
  intentTag?: IntentTag;
}

export interface User {
  id: string;
  name: string;
  color: string;
  role: 'Lead' | 'Contributor' | 'Viewer';
  cursor?: Position;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed';
  assignee?: string;
  authorId?: string;  // ID of user who created the task
  authorName?: string; // Display name of creator
  priority: 'low' | 'medium' | 'high';
  nodeId?: string; // Link back to canvas node
  createdAt: number;
}

export interface CanvasState {
  elements: Map<string, CanvasElement>;
  selectedIds: Set<string>;
  tool: Tool;
  shapeType: ShapeType;
  drawColor: string;
  drawSize: number;
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
  comments: Comment[];
  isCommentMode: boolean;
  activeCommentId: string | null;
  hoveredCommentId: string | null;
  pendingCommentX: number | null;
  pendingCommentY: number | null;
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

export interface CommentReply {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  timestamp: number;
  isRead: boolean;
}

export interface Comment {
  id: string;
  canvasX: number;
  canvasY: number;
  authorId: string;
  authorName: string;
  authorColor: string;
  content: string;
  timestamp: number;
  resolved: boolean;
  replies: CommentReply[];
  unreadCount: number;
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