// Main Entry Point for LIMA Backend

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { SocketHandler } from './socket/SocketHandler';
import { EventStore } from './events/EventStore';
import { CanvasStore } from './store/CanvasStore';
import { RBACService } from './rbac/RBACService';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/canvases', (req, res) => {
  const canvases = canvasStore.getAllCanvases();
  res.json({ canvases });
});

app.get('/api/canvases/:canvasId', (req, res) => {
  const { canvasId } = req.params;
  const state = canvasStore.getCanvas(canvasId);
  const info = canvasStore.getCanvasInfo(canvasId);

  if (!info) {
    return res.status(404).json({ error: 'Canvas not found' });
  }

  res.json({
    info,
    state: state ? {
      nodes: Array.from(state.nodes.values()),
      vectorClock: state.vectorClock,
      lastEventId: state.lastEventId
    } : null
  });
});

app.post('/api/canvases', (req, res) => {
  const { canvasId, name } = req.body;
  if (!canvasId || !name) {
    return res.status(400).json({ error: 'canvasId and name required' });
  }

  if (canvasStore.getCanvasInfo(canvasId)) {
    return res.status(409).json({ error: 'Canvas already exists' });
  }

  const info = canvasStore.createCanvas(canvasId, name);
  res.status(201).json({ canvas: info });
});

app.get('/api/canvases/:canvasId/events', (req, res) => {
  const { canvasId } = req.params;
  const { fromTimestamp } = req.query;

  const events = eventStore.getEvents(
    canvasId,
    fromTimestamp ? parseInt(fromTimestamp as string) : undefined
  );

  res.json({ events, canvasId });
});

app.get('/api/canvases/:canvasId/stats', (req, res) => {
  const { canvasId } = req.params;
  const info = canvasStore.getCanvasInfo(canvasId);

  if (!info) {
    return res.status(404).json({ error: 'Canvas not found' });
  }

  const state = canvasStore.getCanvas(canvasId);
  res.json({
    nodeCount: state?.nodes.size || 0,
    eventCount: eventStore.getEventCount(canvasId),
    activeUsers: socketHandler.getConnectedUsers(canvasId).length
  });
});

app.post('/api/canvases/:canvasId/role', (req, res) => {
  const { canvasId } = req.params;
  const { userId, role } = req.body;

  if (!userId || !role) {
    return res.status(400).json({ error: 'userId and role required' });
  }

  const rbac = socketHandler.getRBAC();
  rbac.assignCanvasRole(userId, canvasId, role);

  res.json({ success: true, userId, role });
});

app.get('/api/tasks/:canvasId', (req, res) => {
  const { canvasId } = req.params;
  const tasks = socketHandler.getTaskBoard().getTasksByCanvas(canvasId);
  res.json({ tasks });
});

const eventStore = new EventStore();
const rbac = new RBACService();
const canvasStore = new CanvasStore(eventStore, rbac);
const socketHandler = new SocketHandler(io, eventStore, rbac, canvasStore);

io.on('connection', (socket) => {
  socketHandler.handleConnection(socket);
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`LIMA Backend running on port ${PORT}`);
  console.log(`WebSocket ready for connections`);
});

export { app, io, socketHandler, eventStore, canvasStore };