// Socket.io Handler for LIMA Real-time Collaboration

import { Server, Socket } from 'socket.io';
import { EventStore } from '../events/EventStore';
import { EventBus } from '../events/EventBus';
import { StateReconstructor } from '../events/StateReconstructor';
import { RBACService } from '../rbac/RBACService';
import { IntentExtractor, TaskBoard } from '../ai/IntentExtractor';
import {
  CanvasEvent,
  NodeCreatedEvent,
  NodeUpdatedEvent,
  NodeDeletedEvent,
  NodeLockedEvent,
  NodeUnlockedEvent,
  CursorMovedEvent,
  UserJoinedEvent,
  UserLeftEvent,
  RoleChangedEvent,
  BaseEvent
} from '../events/types';
import { VectorClock } from '../crdt/VectorClock';
import { v4 as uuidv4 } from 'uuid';

interface ConnectedUser {
  socketId: string;
  userId: string;
  userName: string;
  canvasId: string;
  role: 'Lead' | 'Contributor' | 'Viewer';
  vectorClock: VectorClock;
  cursorPosition?: { x: number; y: number };
}

interface ClientState {
  users: Map<string, ConnectedUser>;
  cursors: Map<string, { x: number; y: number; userId: string; userName: string }>;
}

interface ActivityEvent {
  id: string;
  type: 'create' | 'update' | 'delete' | 'lock' | 'unlock';
  elementId: string;
  userId: string;
  userName: string;
  timestamp: number;
  details?: string;
}

export class SocketHandler {
  private io: Server;
  private eventStore: EventStore;
  private eventBus: EventBus;
  private stateReconstructor: StateReconstructor;
  private rbac: RBACService;
  private intentExtractor: IntentExtractor;
  private taskBoard: TaskBoard;
  private clientStates: Map<string, ClientState> = new Map();
  private lastEventPerClient: Map<string, string> = new Map();
  private activityByCanvas: Map<string, ActivityEvent[]> = new Map();
  private activityLimit = 200;

  constructor(io: Server) {
    this.io = io;
    this.eventStore = new EventStore();
    this.eventBus = new EventBus();
    this.stateReconstructor = new StateReconstructor();
    this.rbac = new RBACService();
    this.intentExtractor = new IntentExtractor();
    this.taskBoard = new TaskBoard();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.eventBus.subscribe('NodeCreated', async (event) => {
      const intent = this.intentExtractor.analyze((event as NodeCreatedEvent).content);
      if (intent.type === 'action_item' && intent.suggestedTask) {
        this.taskBoard.addTask({
          nodeId: (event as NodeCreatedEvent).nodeId,
          ...intent.suggestedTask,
          status: 'pending',
          canvasId: event.canvasId
        });
      }
    });
  }

  private getOrCreateClientState(canvasId: string): ClientState {
    if (!this.clientStates.has(canvasId)) {
      this.clientStates.set(canvasId, {
        users: new Map(),
        cursors: new Map()
      });
    }
    return this.clientStates.get(canvasId)!;
  }

  private getOrCreateActivityLog(canvasId: string): ActivityEvent[] {
    if (!this.activityByCanvas.has(canvasId)) {
      this.activityByCanvas.set(canvasId, []);
    }
    return this.activityByCanvas.get(canvasId)!;
  }

  private pushActivity(canvasId: string, event: ActivityEvent): void {
    const log = this.getOrCreateActivityLog(canvasId);
    log.unshift(event);
    if (log.length > this.activityLimit) {
      log.length = this.activityLimit;
    }
    this.io.to(canvasId).emit('activity_event', event);
  }

  handleConnection(socket: Socket): void {
    console.log(`Client connected: ${socket.id}`);

    socket.on('join_canvas', (data: { canvasId: string; userId: string; userName: string; role: 'Lead' | 'Contributor' | 'Viewer' }) => {
      console.log(`Join canvas request from ${data.userName} for canvas ${data.canvasId}`);
      this.handleJoinCanvas(socket, data);
    });

    socket.on('create_node', (data: { canvasId: string; nodeId?: string; nodeType: string; position: { x: number; y: number }; content: string; size?: { width: number; height: number }; color?: string; shapeType?: 'rectangle' | 'circle'; points?: { x: number; y: number }[]; style?: Record<string, unknown> }) => {
      console.log(`Create node request for canvas ${data.canvasId}`);
      this.handleCreateNode(socket, data);
    });

    socket.on('update_node', (data: { canvasId: string; nodeId: string; changes: any; vectorClock: Record<string, number> }) => {
      console.log(`Update node request for canvas ${data.canvasId}`);
      this.handleUpdateNode(socket, data);
    });

    socket.on('delete_node', (data: { canvasId: string; nodeId: string }) => {
      console.log(`Delete node request for canvas ${data.canvasId}`);
      this.handleDeleteNode(socket, data);
    });

    socket.on('lock_node', (data: { canvasId: string; nodeId: string; durationMs?: number }) => {
      
      this.handleLockNode(socket, data);
    });

    socket.on('unlock_node', (data: { canvasId: string; nodeId: string }) => {
      this.handleUnlockNode(socket, data);
    });

    socket.on('cursor_move', (data: { canvasId: string; position: { x: number; y: number } }) => {
      this.handleCursorMove(socket, data);
    });

    socket.on('request_sync', (data: { canvasId: string; lastEventId?: string }) => {
      this.handleSyncRequest(socket, data);
    });

    socket.on('get_event_log', (data: { canvasId: string; fromTimestamp?: number }) => {
      this.handleGetEventLog(socket, data);
    });

    socket.on('get_tasks', (data: { canvasId: string }) => {
      this.handleGetTasks(socket, data);
    });

    socket.on('create_task', (data: { canvasId: string; title: string; description?: string; priority: 'low' | 'medium' | 'high' }) => {
      this.handleCreateTask(socket, data);
    });

    socket.on('update_task_status', (data: { taskId: string; status: 'pending' | 'in_progress' | 'completed' }) => {
      this.handleUpdateTaskStatus(socket, data);
    });

    socket.on('delete_task', (data: { taskId: string }) => {
      this.handleDeleteTask(socket, data);
    });

    socket.on('disconnect', () => {
      this.handleDisconnect(socket);
    });
  }

  private handleJoinCanvas(socket: Socket, data: { canvasId: string; userId: string; userName: string; role: 'Lead' | 'Contributor' | 'Viewer' }): void {
    const { canvasId, userId, userName, role } = data;

    socket.join(canvasId);
    const clientState = this.getOrCreateClientState(canvasId);

    const user: ConnectedUser = {
      socketId: socket.id,
      userId,
      userName,
      canvasId,
      role,
      vectorClock: new VectorClock()
    };
    clientState.users.set(userId, user);

    this.rbac.registerUser(userId, userName, role, canvasId);

    const joinEvent: UserJoinedEvent = {
      id: uuidv4(),
      type: 'UserJoined',
      canvasId,
      userId,
      userName,
      role,
      timestamp: Date.now(),
      vectorClock: user.vectorClock.toJSON()
    };

    this.eventStore.append(joinEvent);
    this.io.to(canvasId).emit('user_joined', joinEvent);

    const activityLog = this.getOrCreateActivityLog(canvasId);
    socket.emit('activity_sync', { events: activityLog });

    const tasks = this.taskBoard.getTasksByCanvas(canvasId);
    socket.emit('tasks_list', { tasks });

    const existingCursors = Array.from(clientState.cursors.values());
    socket.emit('existing_cursors', existingCursors);

    console.log(`User ${userName} joined canvas ${canvasId}`);
  }

  private async handleCreateNode(socket: Socket, data: { canvasId: string; nodeId?: string; nodeType: string; position: { x: number; y: number }; content: string; size?: { width: number; height: number }; color?: string; shapeType?: 'rectangle' | 'circle'; points?: { x: number; y: number }[]; style?: Record<string, unknown> }): Promise<void> {
    const { canvasId, nodeId: clientNodeId, nodeType, position, content, size, color, shapeType, points, style } = data;
    const userId = this.getUserIdFromSocket(socket.id, canvasId);

    if (!userId || !this.rbac.canPerformAction(userId, canvasId, 'canCreate')) {
      socket.emit('error', { message: 'Permission denied' });
      return;
    }

    const clientState = this.clientStates.get(canvasId);
    const user = clientState?.users.get(userId);
    const vc = user?.vectorClock || new VectorClock();

    const nodeId = clientNodeId || uuidv4();
    const event: NodeCreatedEvent = {
      id: uuidv4(),
      type: 'NodeCreated',
      canvasId,
      userId,
      nodeId,
      nodeType: nodeType as 'text' | 'shape' | 'image' | 'sticky' | 'drawing',
      position,
      content,
      timestamp: Date.now(),
      vectorClock: vc.increment(userId).toJSON(),
      metadata: {
        size,
        color,
        shapeType,
        points,
        style
      }
    };

    this.eventStore.append(event);
    this.eventBus.publish(event);

    this.io.to(canvasId).emit('node_created', event);
    socket.emit('node_created_ack', { nodeId, eventId: event.id });

    const userName = this.clientStates.get(canvasId)?.users.get(userId)?.userName || 'Unknown';
    this.pushActivity(canvasId, {
      id: event.id,
      type: 'create',
      elementId: nodeId,
      userId,
      userName,
      timestamp: event.timestamp,
      details: `Created ${nodeType}`
    });

    const intent = this.intentExtractor.analyze(content);
    if (intent.type === 'action_item' && intent.suggestedTask) {
      const task = this.taskBoard.addTask({
        nodeId,
        ...intent.suggestedTask,
        status: 'pending',
        canvasId,
        priority: 'medium'
      });
      this.io.to(canvasId).emit('task_created', task);
    }
  }

  private handleUpdateNode(socket: Socket, data: { canvasId: string; nodeId: string; changes: any; vectorClock: Record<string, number> }): void {
    const { canvasId, nodeId, changes, vectorClock } = data;
    const userId = this.getUserIdFromSocket(socket.id, canvasId);

    if (!userId) return;

    const lockStatus = this.rbac.isNodeLocked(nodeId);
    if (lockStatus.locked && lockStatus.lockedBy !== userId) {
      socket.emit('error', { message: `Node is locked by ${lockStatus.lockedBy}` });
      return;
    }

    if (!this.rbac.canModifyNode(userId, canvasId, nodeId)) {
      socket.emit('error', { message: 'Permission denied' });
      return;
    }

    const clientState = this.clientStates.get(canvasId);
    const user = clientState?.users.get(userId);
    const vc = user?.vectorClock || new VectorClock();

    const events = this.eventStore.getEvents(canvasId);
    const nodeVersion = events.filter(e => e.type === 'NodeUpdated' && (e as NodeUpdatedEvent).nodeId === nodeId).length + 1;

    const event: NodeUpdatedEvent = {
      id: uuidv4(),
      type: 'NodeUpdated',
      canvasId,
      userId,
      nodeId,
      changes,
      version: nodeVersion + 1,
      causallyDependsOn: [],
      timestamp: Date.now(),
      vectorClock: vc.increment(userId).toJSON()
    };

    this.eventStore.append(event);
    this.eventBus.publish(event);

    this.io.to(canvasId).emit('node_updated', event);
    socket.emit('node_updated_ack', { eventId: event.id });

    const userName = this.clientStates.get(canvasId)?.users.get(userId)?.userName || 'Unknown';
    this.pushActivity(canvasId, {
      id: event.id,
      type: 'update',
      elementId: nodeId,
      userId,
      userName,
      timestamp: event.timestamp,
      details: 'Updated node'
    });

    if (changes.content) {
      const intent = this.intentExtractor.analyze(changes.content);
      if (intent.type === 'action_item' && intent.suggestedTask) {
        const existingTasks = this.taskBoard.getPendingTasks(canvasId);
        const linkedTask = existingTasks.find(t => t.nodeId === nodeId);
        if (!linkedTask) {
          this.taskBoard.addTask({
            nodeId,
            ...intent.suggestedTask,
            status: 'pending',
            canvasId
          });
        }
      }
    }
  }

  private handleDeleteNode(socket: Socket, data: { canvasId: string; nodeId: string }): void {
    const { canvasId, nodeId } = data;
    const userId = this.getUserIdFromSocket(socket.id, canvasId);
    
    if (!userId || !this.rbac.canPerformAction(userId, canvasId, 'canDelete')) {
      socket.emit('error', { message: 'Permission denied' });
      return;
    }

    const clientState = this.clientStates.get(canvasId);
    const user = clientState?.users.get(userId);
    const vc = user?.vectorClock || new VectorClock();

    const event: NodeDeletedEvent = {
      id: uuidv4(),
      type: 'NodeDeleted',
      canvasId,
      userId,
      nodeId,
      timestamp: Date.now(),
      vectorClock: vc.increment(userId).toJSON()
    };

    this.eventStore.append(event);
    this.eventBus.publish(event);

    console.log(`Node deleted: ${nodeId} by user ${userId} on canvas ${canvasId}`);

    this.io.to(canvasId).emit('node_deleted', event);
    socket.emit('node_deleted_ack', { eventId: event.id });

    const userName = this.clientStates.get(canvasId)?.users.get(userId)?.userName || 'Unknown';
    this.pushActivity(canvasId, {
      id: event.id,
      type: 'delete',
      elementId: nodeId,
      userId,
      userName,
      timestamp: event.timestamp,
      details: 'Deleted node'
    });
  }

  private handleLockNode(socket: Socket, data: { canvasId: string; nodeId: string; durationMs?: number }): void {
    const { canvasId, nodeId, durationMs } = data;
    const userId = this.getUserIdFromSocket(socket.id, canvasId);

    if (!userId) return;

    const success = this.rbac.lockNode(nodeId, userId, canvasId, durationMs);
    if (!success) {
      socket.emit('error', { message: 'Failed to lock node' });
      return;
    }

    const clientState = this.clientStates.get(canvasId);
    const user = clientState?.users.get(userId);
    const vc = user?.vectorClock || new VectorClock();

    const event: NodeLockedEvent = {
      id: uuidv4(),
      type: 'NodeLocked',
      canvasId,
      userId,
      nodeId,
      lockedBy: userId,
      lockExpiry: durationMs ? Date.now() + durationMs : undefined,
      timestamp: Date.now(),
      vectorClock: vc.increment(userId).toJSON()
    };

    this.eventStore.append(event);
    this.io.to(canvasId).emit('node_locked', event);

    const userName = this.clientStates.get(canvasId)?.users.get(userId)?.userName || 'Unknown';
    this.pushActivity(canvasId, {
      id: event.id,
      type: 'lock',
      elementId: nodeId,
      userId,
      userName,
      timestamp: event.timestamp,
      details: 'Locked node'
    });
  }

  private handleUnlockNode(socket: Socket, data: { canvasId: string; nodeId: string }): void {
    const { canvasId, nodeId } = data;
    const userId = this.getUserIdFromSocket(socket.id, canvasId);

    if (!userId) return;

    const success = this.rbac.unlockNode(nodeId, userId);
    if (!success) {
      socket.emit('error', { message: 'Failed to unlock node' });
      return;
    }

    const clientState = this.clientStates.get(canvasId);
    const user = clientState?.users.get(userId);
    const vc = user?.vectorClock || new VectorClock();

    const event: NodeUnlockedEvent = {
      id: uuidv4(),
      type: 'NodeUnlocked',
      canvasId,
      userId,
      nodeId,
      timestamp: Date.now(),
      vectorClock: vc.increment(userId).toJSON()
    };

    this.eventStore.append(event);
    this.io.to(canvasId).emit('node_unlocked', event);

    const userName = this.clientStates.get(canvasId)?.users.get(userId)?.userName || 'Unknown';
    this.pushActivity(canvasId, {
      id: event.id,
      type: 'unlock',
      elementId: nodeId,
      userId,
      userName,
      timestamp: event.timestamp,
      details: 'Unlocked node'
    });
  }

  private handleCursorMove(socket: Socket, data: { canvasId: string; position: { x: number; y: number } }): void {
    const { canvasId, position } = data;
    const userId = this.getUserIdFromSocket(socket.id, canvasId);

    if (!userId) return;

    const clientState = this.clientStates.get(canvasId);
    const user = clientState?.users.get(userId);

    if (user) {
      user.cursorPosition = position;
      clientState?.cursors.set(socket.id, {
        ...position,
        userId,
        userName: user.userName
      });
    }

    const event: CursorMovedEvent = {
      id: uuidv4(),
      type: 'CursorMoved',
      canvasId,
      userId,
      position,
      timestamp: Date.now(),
      vectorClock: (user?.vectorClock || new VectorClock()).increment(userId).toJSON()
    };

    socket.to(canvasId).emit('cursor_moved', {
      userId,
      userName: user?.userName,
      position
    });
  }

  private handleSyncRequest(socket: Socket, data: { canvasId: string; lastEventId?: string }): void {
    const { canvasId, lastEventId } = data;

    let events: CanvasEvent[];
    if (lastEventId) {
      events = this.eventStore.getEventsSince(canvasId, lastEventId);
    } else {
      events = this.eventStore.getEvents(canvasId);
    }

    const state = this.stateReconstructor.reconstruct(canvasId, events);

    this.lastEventPerClient.set(socket.id, state.lastEventId);

    socket.emit('sync_response', {
      events,
      state: {
        nodes: Array.from(state.nodes.values()),
        vectorClock: state.vectorClock,
        lastEventId: state.lastEventId
      }
    });
  }

  private handleGetEventLog(socket: Socket, data: { canvasId: string; fromTimestamp?: number }): void {
    const { canvasId, fromTimestamp } = data;
    const events = this.eventStore.getEvents(canvasId, fromTimestamp);
    socket.emit('event_log', { events, canvasId });
  }

  private handleGetTasks(socket: Socket, data: { canvasId: string }): void {
    const { canvasId } = data;
    const tasks = this.taskBoard.getTasksByCanvas(canvasId);
    socket.emit('tasks_list', { tasks });
  }

  private handleUpdateTaskStatus(socket: Socket, data: { taskId: string; status: 'pending' | 'in_progress' | 'completed' }): void {
    const { taskId, status } = data;
    const task = this.taskBoard.getTask(taskId);
    const success = this.taskBoard.updateTaskStatus(taskId, status);
    socket.emit('task_status_updated', { taskId, success });
    if (success) {
      const canvasId = task?.canvasId;
      if (canvasId) {
        this.io.to(canvasId).emit('task_updated', { taskId, status });
      } else {
        this.io.emit('task_updated', { taskId, status });
      }
    }
  }

  private handleCreateTask(socket: Socket, data: { canvasId: string; title: string; description?: string; priority: 'low' | 'medium' | 'high' }): void {
    const { canvasId, title, description, priority } = data;
    const userId = this.getUserIdFromSocket(socket.id, canvasId);
    const userName = this.clientStates.get(canvasId)?.users.get(userId || '')?.userName || 'Unknown';

    if (!userId) return;

    const task = this.taskBoard.addTask({
      nodeId: `manual-${Date.now()}`,
      title,
      description,
      status: 'pending',
      canvasId,
      assignee: userName,
      dueDate: undefined,
      priority
    });

    this.io.to(canvasId).emit('task_created', task);
  }

  private handleDeleteTask(socket: Socket, data: { taskId: string }): void {
    const { taskId } = data;
    const task = this.taskBoard.getTask(taskId);
    const success = this.taskBoard.deleteTask(taskId);
    if (success) {
      const canvasId = task?.canvasId;
      if (canvasId) {
        this.io.to(canvasId).emit('task_deleted', { taskId });
      } else {
        this.io.emit('task_deleted', { taskId });
      }
    }
  }

  private handleDisconnect(socket: Socket): void {
    for (const [canvasId, clientState] of this.clientStates.entries()) {
      for (const [userId, user] of clientState.users.entries()) {
        if (user.socketId === socket.id) {
          const leaveEvent: UserLeftEvent = {
            id: uuidv4(),
            type: 'UserLeft',
            canvasId,
            userId,
            timestamp: Date.now(),
            vectorClock: user.vectorClock.increment(userId).toJSON()
          };

          this.eventStore.append(leaveEvent);
          this.io.to(canvasId).emit('user_left', { userId, userName: user.userName });

          clientState.users.delete(userId);
          clientState.cursors.delete(socket.id);

          console.log(`User ${user.userName} disconnected from canvas ${canvasId}`);
          break;
        }
      }
    }
  }

  private getUserIdFromSocket(socketId: string, canvasId: string): string | undefined {
    const clientState = this.clientStates.get(canvasId);
    if (!clientState) return undefined;

    for (const [userId, user] of clientState.users.entries()) {
      if (user.socketId === socketId) {
        return userId;
      }
    }
    return undefined;
  }

  getConnectedUsers(canvasId: string): ConnectedUser[] {
    const clientState = this.clientStates.get(canvasId);
    return clientState ? Array.from(clientState.users.values()) : [];
  }

  getEventStore(): EventStore {
    return this.eventStore;
  }

  getRBAC(): RBACService {
    return this.rbac;
  }

  getTaskBoard(): TaskBoard {
    return this.taskBoard;
  }
}