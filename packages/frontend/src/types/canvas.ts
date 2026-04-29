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

export interface AuthUser {
  id: string;
  username: string;
  createdAt: number;
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
  intentType?: 'action_item' | 'decision' | 'open_question' | 'reference';
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
  sessionTimeline: { elements: Map<string, CanvasElement>; timestamp: number }[];
  replayFrameElements: Map<string, CanvasElement> | null;
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
  mentions: Mention[];
  attachments?: CommentAttachment[];
}

export interface Mention {
  userId: string;
  userName: string;
}

export interface CommentAttachment {
  id: string;
  name: string;
  url: string; // base64 data URL
  type: string; // MIME type
  size: number;
}

export interface Comment {
  id: string;
  canvasX: number;
  canvasY: number;
  authorId: string;
  authorName: string;
  authorColor: string;
  content: string;
  mentions: Mention[];
  attachments: CommentAttachment[];
  timestamp: number;
  resolved: boolean;
  replies: CommentReply[];
  unreadCount: number;
}

export interface CanvasExportData {
  exportedAt: string;
  version: string;
  viewport: {
    position: Position;
    zoom: number;
  };
  elements: CanvasElement[];
  stats: {
    stickyNotes: number;
    textBlocks: number;
    shapes: number;
    drawings: number;
  };
}

export interface GroupState {
  id: string;
  canvasId: string;
  nodeIds: string[];
  ownerId: string;
  coOwners: string[];
  createdAt: number;
  createdBy: string;
}

export interface GroupPermission {
  canMove: boolean;
  canResize: boolean;
  canEditContent: boolean;
  canDelete: boolean;
  canManageOwners: boolean;
}

export interface MentionNotification {
  id: string;
  commentId: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  content: string;
  mentionedUserId: string;
  timestamp: number;
  read: boolean;
}
}

export interface SocketEvents {
  create_node: CanvasElement;
  update_node: CanvasElement;
  delete_node: string;
  lock_node: { elementId: string; userId: string };
  unlock_node: string;
  lock_nodes: { nodeIds: string[]; userId: string };
  unlock_nodes: { nodeIds: string[]; userId: string };
  nodes_locked: { events: any[]; failed: string[] };
  nodes_unlocked: { events: any[]; failed: string[] };
  bulk_lock_result: { successful: string[]; failed: string[] };
  bulk_unlock_result: { successful: string[]; failed: string[] };
  cursor_move: { userId: string; position: Position };
  user_joined: User;
  user_left: string;
// Group events
  group_created: { group: GroupState; event: any };
  group_deleted: { groupId: string; event: any };
  group_owner_added: { group: GroupState; event: any };
  group_owner_removed: { group: GroupState; event: any };
  group_permissions: { permissions: GroupPermission };
}
