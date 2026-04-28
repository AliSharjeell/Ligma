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
import { PersistenceService } from '../store/PersistenceService';
import { CanvasStore } from '../store/CanvasStore';

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
  roleRequests: Map<string, { userId: string; userName: string; requestedAt: number }>;
  ownerId: string | null; // C: Room owner - can never be demoted, transfers on disconnect
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
  private canvasStore: CanvasStore;
  private eventBus: EventBus;
  private stateReconstructor: StateReconstructor;
  private rbac: RBACService;
  private intentExtractor: IntentExtractor;
  private taskBoard: TaskBoard;
  private persistence: PersistenceService;
  private clientStates: Map<string, ClientState> = new Map();
  private lastEventPerClient: Map<string, string> = new Map();
  private activityByCanvas: Map<string, ActivityEvent[]> = new Map();
  private activityLimit = 200;

  constructor(io: Server, eventStore: EventStore, rbac: RBACService, canvasStore: CanvasStore) {
    this.io = io;
    this.eventStore = eventStore;
    this.rbac = rbac;
    this.canvasStore = canvasStore;
    this.eventBus = new EventBus();
    this.stateReconstructor = new StateReconstructor();
    this.intentExtractor = new IntentExtractor();
    this.taskBoard = new TaskBoard();
    this.persistence = new PersistenceService();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.eventBus.subscribe('NodeCreated', async (event) => {
      const intent = this.intentExtractor.analyze((event as NodeCreatedEvent).content);
      if (intent.type === 'action_item' && intent.suggestedTask) {
        const task = this.taskBoard.addTask({
          nodeId: (event as NodeCreatedEvent).nodeId,
          ...intent.suggestedTask,
          status: 'pending',
          canvasId: event.canvasId,
          priority: 'medium'
        });
        await this.persistence.saveTask(task);
        this.io.to(event.canvasId).emit('task_created', task);
      }
    });
  }

  private getOrCreateClientState(canvasId: string): ClientState {
    if (!this.clientStates.has(canvasId)) {
      this.clientStates.set(canvasId, {
        users: new Map(),
        cursors: new Map(),
        roleRequests: new Map(),
        ownerId: null
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

    socket.on('join_canvas', (data: { canvasId: string; userId: string; userName: string; role?: 'Lead' | 'Contributor' | 'Viewer' }) => {
      console.log(`Join canvas request from ${data.userName} for canvas ${data.canvasId}`);
      this.handleJoinCanvas(socket, data);
    });

    socket.on('change_role', (data: { canvasId: string; targetUserId: string; newRole: 'Lead' | 'Contributor' | 'Viewer' }) => {
      this.handleChangeRole(socket, data);
    });

    // Role request handlers (B: Self-request Contributor)
    socket.on('request_role', (data: { canvasId: string; requestedRole: 'Contributor' }) => {
      this.handleRoleRequest(socket, data);
    });

    socket.on('approve_role_request', (data: { canvasId: string; targetUserId: string }) => {
      this.handleApproveRoleRequest(socket, data);
    });

    socket.on('deny_role_request', (data: { canvasId: string; targetUserId: string }) => {
      this.handleDenyRoleRequest(socket, data);
    });

    // C: Ownership transfer
    socket.on('transfer_ownership', (data: { canvasId: string; targetUserId: string }) => {
      this.handleTransferOwnership(socket, data);
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

  private async handleJoinCanvas(socket: Socket, data: { canvasId: string; userId: string; userName: string; role?: 'Lead' | 'Contributor' | 'Viewer' }): Promise<void> {
    const { canvasId, userId, userName } = data;

    socket.join(canvasId);
    // Debug: log room membership after join
    const room = this.io.sockets.adapter.rooms.get(canvasId);
    console.log(`[DEBUG] User ${userName} joined room ${canvasId}, sockets in room:`, room?.size || 0);

    const clientState = this.getOrCreateClientState(canvasId);

    // If first user, they are Lead. Otherwise, they are Viewer by default.
    let assignedRole: 'Lead' | 'Contributor' | 'Viewer' = 'Viewer';
    if (clientState.users.size === 0) {
      assignedRole = 'Lead';
    } else {
      assignedRole = 'Viewer';
    }

    const user: ConnectedUser = {
      socketId: socket.id,
      userId,
      userName,
      canvasId,
      role: assignedRole,
      vectorClock: new VectorClock()
    };
    clientState.users.set(userId, user);

    // D: Check DB for existing roles first
    const existingRoles = await this.persistence.getRoomRoles(canvasId);
    const existingOwner = await this.persistence.getRoomOwner(canvasId);

    // Determine role: restore from DB if exists, otherwise check ownership
    let finalRole: 'Lead' | 'Contributor' | 'Viewer';

    if (existingOwner && existingOwner === userId) {
      // User is the owner - always Lead
      finalRole = 'Lead';
      user.role = 'Lead';
      clientState.ownerId = userId;
      console.log(`User ${userName} is the room owner (restored)`);
    } else if (existingOwner) {
      // There IS an owner, check if this user has a saved role
      const userRole = existingRoles.find(r => r.userId === userId);
      if (userRole) {
        finalRole = userRole.role as 'Lead' | 'Contributor' | 'Viewer';
        user.role = finalRole;
        console.log(`Restored role ${finalRole} for ${userName} from DB`);
      } else {
        // New user joining a room that has an owner - default to Viewer
        finalRole = 'Viewer';
        user.role = 'Viewer';
        console.log(`User ${userName} joined as Viewer`);
      }
    } else {
      // No owner exists - first user becomes owner
      finalRole = 'Lead';
      user.role = 'Lead';
      clientState.ownerId = userId;
      console.log(`User ${userName} is now the room owner (first user)`);
    }

    this.rbac.registerUser(userId, userName, finalRole, canvasId);

    // D: Persist role to DB
    await this.persistence.saveRoomRole(canvasId, userId, finalRole, clientState.ownerId === userId);

    // PERSISTENCE: Load all historical events for this room and catch up the in-memory store
    const historicalEvents = await this.persistence.getEvents(canvasId);
    if (historicalEvents.length > 0 && this.eventStore.getEvents(canvasId).length === 0) {
      historicalEvents.forEach(e => this.eventStore.append(e));
      console.log(`Replayed ${historicalEvents.length} events for canvas ${canvasId}`);
    }

    // SYNC: Send historical canvas events to the new user so they can render the canvas
    const nodeEvents = historicalEvents.filter(e =>
      e.type === 'NodeCreated' || e.type === 'NodeUpdated' || e.type === 'NodeDeleted'
    );
    if (nodeEvents.length > 0) {
      nodeEvents.forEach(event => {
        if (event.type === 'NodeCreated') {
          socket.emit('node_created', event);
        } else if (event.type === 'NodeUpdated') {
          socket.emit('node_updated', event);
        } else if (event.type === 'NodeDeleted') {
          socket.emit('node_deleted', event);
        }
      });
      console.log(`Synced ${nodeEvents.length} node events to new user ${userName}`);
    }

    const joinEvent: UserJoinedEvent = {
      id: uuidv4(),
      type: 'UserJoined',
      canvasId,
      userId,
      userName,
      role: assignedRole,
      timestamp: Date.now(),
      vectorClock: user.vectorClock.toJSON()
    };

    // We don't necessarily persist JOIN events to the DB to keep it clean, 
    // but we add them to the in-memory event store for the current session.
    this.eventStore.append(joinEvent);
    this.io.to(canvasId).emit('user_joined', joinEvent);

    // Send the current list of users to the newcomer
    const currentUsers = Array.from(clientState.users.values()).map(u => ({
      userId: u.userId,
      userName: u.userName,
      role: u.role
    }));
    socket.emit('initial_users', { users: currentUsers, yourRole: assignedRole });

    // Sync activity log from memory (session-based)
    const activityLog = this.getOrCreateActivityLog(canvasId);
    socket.emit('activity_sync', { events: activityLog });

    // PERSISTENCE: Load tasks from DB
    const historicalTasks = await this.persistence.getTasks(canvasId);
    historicalTasks.forEach(t => {
      if (!this.taskBoard.getTask(t.id)) {
        this.taskBoard.addTask(t);
      }
    });
    
    const tasks = this.taskBoard.getTasksByCanvas(canvasId);
    socket.emit('tasks_list', { tasks });

    const existingCursors = Array.from(clientState.cursors.values());
    socket.emit('existing_cursors', existingCursors);

    // HYDRATION: Send the current state of the canvas to the newcomer
    const state = this.canvasStore.getCanvas(canvasId);
    if (state) {
      socket.emit('sync_response', {
        events: this.eventStore.getEvents(canvasId),
        state: {
          nodes: Array.from(state.nodes.values()),
          vectorClock: state.vectorClock,
          lastEventId: state.lastEventId
        }
      });
    }

    console.log(`User ${userName} joined canvas ${canvasId} as ${assignedRole}`);
  }

  private handleChangeRole(socket: Socket, data: { canvasId: string; targetUserId: string; newRole: 'Lead' | 'Contributor' | 'Viewer' }): void {
    const { canvasId, targetUserId, newRole } = data;
    const requesterId = this.getUserIdFromSocket(socket.id, canvasId);
    const clientState = this.clientStates.get(canvasId);

    if (!requesterId || !clientState) return;

    // C: Cannot demote the room owner
    if (clientState.ownerId === targetUserId && newRole !== 'Lead') {
      socket.emit('error', { message: 'Cannot demote the room owner' });
      return;
    }

    const success = this.rbac.changeRole(requesterId, canvasId, targetUserId, newRole);
    if (!success) {
      socket.emit('error', { message: 'Permission denied to change roles' });
      return;
    }

    const targetUser = clientState.users.get(targetUserId);
    if (targetUser) {
      targetUser.role = newRole;
    }

    // D: Persist role change to DB
    this.persistence.saveRoomRole(canvasId, targetUserId, newRole, clientState.ownerId === targetUserId);

    this.io.to(canvasId).emit('role_changed', {
      userId: targetUserId,
      newRole,
      timestamp: Date.now()
    });

    console.log(`Role of user ${targetUserId} changed to ${newRole} by ${requesterId}`);
  }

  // C: Transfer ownership
  private handleTransferOwnership(socket: Socket, data: { canvasId: string; targetUserId: string }): void {
    const { canvasId, targetUserId } = data;
    const requesterId = this.getUserIdFromSocket(socket.id, canvasId);
    const clientState = this.clientStates.get(canvasId);

    if (!requesterId || !clientState) return;

    // Only owner can transfer ownership
    if (clientState.ownerId !== requesterId) {
      socket.emit('error', { message: 'Only the owner can transfer ownership' });
      return;
    }

    const oldOwner = clientState.users.get(requesterId);
    const newOwner = clientState.users.get(targetUserId);

    if (!newOwner) {
      socket.emit('error', { message: 'User not found' });
      return;
    }

    // Transfer ownership
    clientState.ownerId = targetUserId;
    oldOwner!.role = 'Contributor';
    newOwner.role = 'Lead';

    this.rbac.assignCanvasRole(requesterId, canvasId, 'Contributor');
    this.rbac.assignCanvasRole(targetUserId, canvasId, 'Lead');

    // D: Persist ownership transfer to DB
    this.persistence.saveRoomRole(canvasId, requesterId, 'Contributor', false);
    this.persistence.saveRoomRole(canvasId, targetUserId, 'Lead', true);

    // Notify everyone
    this.io.to(canvasId).emit('role_changed', {
      userId: requesterId,
      newRole: 'Contributor',
      timestamp: Date.now()
    });
    this.io.to(canvasId).emit('role_changed', {
      userId: targetUserId,
      newRole: 'Lead',
      timestamp: Date.now()
    });
    this.io.to(canvasId).emit('ownership_transferred', {
      oldOwnerId: requesterId,
      newOwnerId: targetUserId,
      timestamp: Date.now()
    });

    console.log(`Ownership transferred from ${oldOwner?.userName} to ${newOwner.userName}`);
  }

  // B: Self-request Contributor system
  private handleRoleRequest(socket: Socket, data: { canvasId: string; requestedRole: 'Contributor' }): void {
    const { canvasId, requestedRole } = data;
    const userId = this.getUserIdFromSocket(socket.id, canvasId);
    const clientState = this.clientStates.get(canvasId);
    const user = clientState?.users.get(userId);

    if (!userId || !clientState || !user) return;

    // Only Viewers can request Contributor
    if (user.role !== 'Viewer') {
      socket.emit('error', { message: 'Only Viewers can request a role change' });
      return;
    }

    // Add to role requests
    clientState.roleRequests.set(userId, {
      userId,
      userName: user.userName,
      requestedAt: Date.now()
    });

    // Notify all Leads about the request
    this.io.to(canvasId).emit('role_request', {
      userId,
      userName: user.userName,
      requestedRole,
      timestamp: Date.now()
    });

    console.log(`User ${user.userName} requested ${requestedRole} role`);
  }

  private handleApproveRoleRequest(socket: Socket, data: { canvasId: string; targetUserId: string }): void {
    const { canvasId, targetUserId } = data;
    const requesterId = this.getUserIdFromSocket(socket.id, canvasId);
    const clientState = this.clientStates.get(canvasId);

    if (!requesterId || !clientState) return;

    // Only Leads can approve
    const requester = clientState.users.get(requesterId);
    if (!requester || requester.role !== 'Lead') {
      socket.emit('error', { message: 'Only Leads can approve role requests' });
      return;
    }

    // Remove from pending requests
    clientState.roleRequests.delete(targetUserId);

    // Update role to Contributor
    const targetUser = clientState.users.get(targetUserId);
    if (targetUser) {
      targetUser.role = 'Contributor';
      this.rbac.assignCanvasRole(targetUserId, canvasId, 'Contributor');
    }

    // D: Persist role change to DB
    this.persistence.saveRoomRole(canvasId, targetUserId, 'Contributor', false);

    // Notify everyone
    this.io.to(canvasId).emit('role_changed', {
      userId: targetUserId,
      newRole: 'Contributor',
      timestamp: Date.now()
    });

    // Confirm to the approver
    socket.emit('role_request_approved', { userId: targetUserId });

    console.log(`Lead ${requester.userName} approved Contributor role for ${targetUser?.userName}`);
  }

  private handleDenyRoleRequest(socket: Socket, data: { canvasId: string; targetUserId: string }): void {
    const { canvasId, targetUserId } = data;
    const requesterId = this.getUserIdFromSocket(socket.id, canvasId);
    const clientState = this.clientStates.get(canvasId);

    if (!requesterId || !clientState) return;

    // Only Leads can deny
    const requester = clientState.users.get(requesterId);
    if (!requester || requester.role !== 'Lead') {
      socket.emit('error', { message: 'Only Leads can deny role requests' });
      return;
    }

    // Remove from pending requests
    clientState.roleRequests.delete(targetUserId);

    // Notify the requester they were denied
    const targetSocket = this.findSocketByUserId(targetUserId, canvasId);
    if (targetSocket) {
      targetSocket.emit('role_request_denied', {});
    }

    console.log(`Lead ${requester.userName} denied role request for ${targetUserId}`);
  }

  private findSocketByUserId(userId: string, canvasId: string): Socket | undefined {
    const sockets = this.io.sockets.adapter.rooms.get(canvasId);
    if (!sockets) return undefined;

    for (const socketId of sockets) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket && socket.data.userId === userId) {
        return socket;
      }
    }
    return undefined;
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
    await this.persistence.saveEvent(event);

    // Debug: log room membership
    const room = this.io.sockets.adapter.rooms.get(canvasId);
    console.log(`[DEBUG] Emitting node_created to room ${canvasId}, sockets in room:`, room?.size || 0);
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

  private async handleUpdateNode(socket: Socket, data: { canvasId: string; nodeId: string; changes: any; vectorClock: Record<string, number> }): Promise<void> {
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
    await this.persistence.saveEvent(event);

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

  private async handleDeleteNode(socket: Socket, data: { canvasId: string; nodeId: string }): Promise<void> {
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
    await this.persistence.saveEvent(event);

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

  private async handleLockNode(socket: Socket, data: { canvasId: string; nodeId: string; durationMs?: number }): Promise<void> {
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
    await this.persistence.saveEvent(event);
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

  private async handleUnlockNode(socket: Socket, data: { canvasId: string; nodeId: string }): Promise<void> {
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
    await this.persistence.saveEvent(event);
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

  private async handleUpdateTaskStatus(socket: Socket, data: { taskId: string; status: 'pending' | 'in_progress' | 'completed' }): Promise<void> {
    const { taskId, status } = data;
    const task = this.taskBoard.getTask(taskId);
    const success = this.taskBoard.updateTaskStatus(taskId, status);
    
    if (success && task) {
      await this.persistence.saveTask({ ...task, status });
      const canvasId = task.canvasId;
      this.io.to(canvasId).emit('task_updated', { taskId, status });
    }
    
    socket.emit('task_status_updated', { taskId, success });
  }

  private async handleCreateTask(socket: Socket, data: { canvasId: string; title: string; description?: string; priority: 'low' | 'medium' | 'high' }): Promise<void> {
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

    await this.persistence.saveTask(task);
    this.io.to(canvasId).emit('task_created', task);
  }

  private async handleDeleteTask(socket: Socket, data: { taskId: string }): Promise<void> {
    const { taskId } = data;
    const task = this.taskBoard.getTask(taskId);
    const success = this.taskBoard.deleteTask(taskId);
    if (success && task) {
      await this.persistence.deleteTask(taskId);
      const canvasId = task.canvasId;
      this.io.to(canvasId).emit('task_deleted', { taskId });
    }
  }

  private handleDisconnect(socket: Socket): void {
    for (const [canvasId, clientState] of this.clientStates.entries()) {
      for (const [userId, user] of clientState.users.entries()) {
        if (user.socketId === socket.id) {
          const wasOwner = clientState.ownerId === userId;
          const disconnectedUserName = user.userName;

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

          // D: Remove user from DB roles (but keep if owner to preserve on reconnect)
          if (!wasOwner) {
            this.persistence.removeRoomUser(canvasId, userId);
          }

          // C: Transfer ownership if owner disconnects
          if (wasOwner) {
            // Find the most senior Contributor to become new Lead
            let newOwner: ConnectedUser | null = null;
            for (const [, u] of clientState.users.entries()) {
              if (u.role === 'Contributor') {
                if (!newOwner) {
                  newOwner = u;
                }
              }
            }

            // If no Contributor, promote the first Viewer
            if (!newOwner && clientState.users.size > 0) {
              const firstUser = clientState.users.values().next().value;
              if (firstUser) {
                newOwner = firstUser;
              }
            }

            if (newOwner) {
              clientState.ownerId = newOwner.userId;
              newOwner.role = 'Lead';
              this.rbac.assignCanvasRole(newOwner.userId, canvasId, 'Lead');

              // D: Persist ownership transfer to DB
              this.persistence.saveRoomRole(canvasId, userId, 'Contributor', false);
              this.persistence.saveRoomRole(canvasId, newOwner.userId, 'Lead', true);

              this.io.to(canvasId).emit('role_changed', {
                userId: newOwner.userId,
                newRole: 'Lead',
                timestamp: Date.now()
              });
              this.io.to(canvasId).emit('ownership_transferred', {
                oldOwnerId: userId,
                newOwnerId: newOwner.userId,
                timestamp: Date.now()
              });

              console.log(`Ownership transferred from ${disconnectedUserName} to ${newOwner.userName}`);
            } else {
              clientState.ownerId = null;
              console.log(`Owner ${disconnectedUserName} left, no users to transfer ownership to`);
            }
          }

          console.log(`User ${disconnectedUserName} disconnected from canvas ${canvasId}`);
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