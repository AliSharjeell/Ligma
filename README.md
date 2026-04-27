# LIGMA - Real-Time Collaborative Workspace

A hackathon project for building a real-time collaborative canvas workspace with AI-powered features, CRDT-based conflict resolution, and event-sourced architecture.

## Table of Contents

- [Architecture](#architecture)
- [Technical Choices](#technical-choices)
- [Setup Instructions](#setup-instructions)
- [API Endpoints](#api-endpoints)
- [Event Schema](#event-schema)

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                    CLIENTS                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Browser   │  │   Browser   │  │   Browser   │  │   Browser   │              │
│  │   User A    │  │   User B    │  │   User C    │  │   User D    │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
└─────────┼────────────────┼────────────────┼────────────────┼──────────────────────┘
          │                │                │                │
          │ WebSocket      │ WebSocket      │ WebSocket      │ WebSocket
          │ + REST         │ + REST         │ + REST         │ + REST
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               NEXT.JS FRONTEND                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                           React Components                               │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │    │
│  │  │  Toolbar │  │  Canvas  │  │  Panels  │  │   AI     │  │ Presence │  │    │
│  │  │  Component│ │  (Konva) │  │          │  │ Assistant│  │  Cursor  │  │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                         CRDT Layer (Yjs)                                │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │    │
│  │  │  Y.Map   │  │ Y.Array  │  │ Y.Text   │  │ Awareness│                │    │
│  │  │ (Nodes)  │  │(Layers)  │  │(Labels)  │  │(Cursors) │                │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                    WebSocket Client (Socket.io)                        │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │
                     HTTP/REST + WebSocket
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            NODE.JS BACKEND                                        │
│                                                                                   │
│  ┌───────────────────────────────────────────────────────────────────────────┐    │
│  │                         Express Server                                    │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐         │    │
│  │  │    REST    │  │ Socket.io  │  │    Auth     │  │    RBAC    │         │    │
│  │  │   Router   │  │   Server   │  │  Middleware │  │   Guard    │         │    │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘         │    │
│  └───────────────────────────────────────────────────────────────────────────┘    │
│                                                                                   │
│  ┌───────────────────────────────────────────────────────────────────────────┐    │
│  │                       Event Sourcing Layer                                 │    │
│  │  ┌─────────────────────────────────────────────────────────────────┐    │    │
│  │  │                      Event Store                                  │    │    │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │    │    │
│  │  │  │ NodeAdd │ │NodeUpdate│ │NodeDelete│ │NodeMove │ │NodeRole │   │    │    │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │    │    │
│  │  └─────────────────────────────────────────────────────────────────┘    │    │
│  │  ┌─────────────────────────────────────────────────────────────────┐    │    │
│  │  │                    Projection Engine                            │    │    │
│  │  └─────────────────────────────────────────────────────────────────┘    │    │
│  └───────────────────────────────────────────────────────────────────────────┘    │
│                                                                                   │
│  ┌───────────────────────────────────────────────────────────────────────────┐    │
│  │                       AI Intent Extraction                                 │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐          │    │
│  │  │  Parser    │  │  Intent    │  │   Node     │  │   Action   │          │    │
│  │  │  (NLP)     │  │ Classifier │  │  Extractor │  │  Resolver  │          │    │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘          │    │
│  └───────────────────────────────────────────────────────────────────────────┘    │
│                                                                                   │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATA STORAGE                                         │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐              │
│  │     PostgreSQL              │  │     Redis                   │              │
│  │  ┌─────────────────────────┐ │  │  ┌─────────────────────────┐│              │
│  │  │  canvases               │ │  │  │  session_cache         ││              │
│  │  │  nodes                  │ │  │  │  presence_data         ││              │
│  │  │  events                 │ │  │  │  rate_limits           ││              │
│  │  │  users                  │ │  │  │  pub/sub               ││              │
│  │  │  permissions            │ │  │  │                        ││              │
│  │  └─────────────────────────┘ │  │  └─────────────────────────┘│              │
│  └─────────────────────────────┘  └─────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Event Flow

```
User Action                  CRDT Operation              Server Processing
────────────────────────────────────────────────────────────────────────────

┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  User moves  │───▶│  Yjs update  │───▶│  Local CRDT  │───▶│  WebSocket   │
│    node      │    │  generated   │    │   applied    │    │   emit       │
└──────────────┘    └──────────────┘    └──────────────┘    └──────┬───────┘
                                                                      │
                     ┌──────────────────────────────────────────┐       │
                     │              Broadcast Loop              │       │
                     │                                          │       ▼
                     ▼                                  ┌──────────────┐
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    │  Other       │
│  Server      │◀───│  Event       │◀───│  Event       │◀───┤  Clients     │
│  validates   │    │  persisted   │    │  projected   │    └──────────────┘
└──────────────┘    └──────────────┘    └──────────────┘
```

### WebSocket Connection Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Connect    │────▶│  Authenticate│────▶│  Join Room  │────▶│  Sync State │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                  │                   │                   │
       ▼                  ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Handshake   │     │ JWT verify  │     │ Canvas room │    │ Yjs sync    │
│ + Socket ID │     │ RBAC check  │     │ subscribed   │    │ protocol    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

---

## Technical Choices

### CRDT Strategy for Conflict Resolution

LIGMA uses **Yjs** as the CRDT (Conflict-free Replicated Data Type) implementation. This choice provides automatic conflict resolution without requiring complex locking mechanisms.

#### Why Yjs?

| Feature | Benefit |
|---------|---------|
| **Automatic Merging** | Concurrent edits merge automatically |
| **Network Efficiency** | Only deltas are transmitted |
| **Offline Support** | Changes sync when reconnected |
| **Type Safety** | Structured data types (Map, Array, Text) |

#### Data Structure

```typescript
// Canvas document structure in Yjs
Y.Doc
├── nodes: Y.Map<string, NodeData>        // All canvas nodes by ID
├── layers: Y.Array<string>               // Ordered layer IDs
├── metadata: Y.Map                       // Canvas settings
└── awareness: Awareness                  // Cursor/presence data
```

#### Conflict Resolution Rules

1. **Node Position Conflicts**: Last-writer-wins with Lamport timestamps
2. **Node Property Conflicts**: Property-level merge (each field independent)
3. **Concurrent Deletes**: If Node A deletes while Node B edits, delete wins
4. **Layer Order Conflicts**: Sequence CRDT ensures consistent ordering

#### Node Data Model

```typescript
interface NodeData {
  id: string;                    // Unique identifier (UUID)
  type: 'rectangle' | 'ellipse' | 'text' | 'image' | 'group';
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation: number;
  style: NodeStyle;
  content?: string;               // For text nodes
  parentId?: string;              // For grouping
  zIndex: number;
  lockedBy?: string;              // User ID if being edited
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  vectorClock: Record<string, number>; // For causal ordering
}
```

### Event-Sourcing Architecture

LIGMA adopts **Event Sourcing** to maintain a complete audit trail and enable powerful features like time-travel and replay.

#### Why Event Sourcing?

| Reason | Description |
|--------|-------------|
| **Audit Trail** | Complete history of all changes |
| **Replay** | Rebuild state at any point in time |
| **Temporal Queries** | "What did this canvas look like 2 hours ago?" |
| **Event Replay** | Support collaborative undo/redo |

#### Event Structure

```typescript
interface CanvasEvent {
  id: string;                     // Event UUID
  type: EventType;                // Event type enum
  canvasId: string;               // Target canvas
  userId: string;                 // Actor
  timestamp: number;              // Unix timestamp
  vectorClock: Record<string, number>;
  payload: EventPayload;          // Type-specific data
  metadata: {
    sessionId: string;
    clientId: string;
    ipAddress?: string;
  };
}

type EventType =
  | 'NODE_ADDED'
  | 'NODE_UPDATED'
  | 'NODE_DELETED'
  | 'NODE_MOVED'
  | 'LAYER_CHANGED'
  | 'CANVAS_CREATED'
  | 'CANVAS_ARCHIVED';
```

#### Event Processing Pipeline

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Event     │───▶│  Validate   │───▶│  Persist    │───▶│  Project    │
│   Emit      │    │  Schema     │    │  to Store   │    │  to Read    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                │
                     ┌───────────────────────────────────────────┘
                     ▼
              ┌─────────────┐    ┌─────────────┐
              │  Broadcast  │───▶│  Consumers  │
              │  to Clients │    │  (optional) │
              └─────────────┘    └─────────────┘
```

#### Snapshot Strategy

- **Snapshot Frequency**: Every 100 events or 5 minutes
- **Retention**: Keep last 10,000 events per canvas
- **Compaction**: Merge old events into snapshots

### WebSocket Delta Broadcasting

LIGMA uses **Socket.io** for real-time communication with delta-based updates.

#### Broadcast Strategy

```typescript
// Server-side broadcast configuration
const broadcastConfig = {
  // Delta compression - only send changed data
  compression: true,

  // Room-based routing
  rooms: {
    // Each canvas is a room
    canvas: canvasId,

    // Optional: view-only rooms
    viewers: `${canvasId}:viewers`
  },

  // Fan-out optimization
  fanout: {
    // For >10 users, use Redis adapter
    threshold: 10,

    // Batch updates within 16ms window
    batchWindow: 16
  }
};
```

#### Update Types

| Update Type | Trigger | Recipients |
|------------|---------|------------|
| `node:change` | Single node modified | All in canvas |
| `cursor:move` | Cursor position changed | All in canvas |
| `selection:change` | User selects nodes | All in canvas |
| `presence:join` | User joins canvas | All in canvas |
| `presence:leave` | User leaves canvas | All in canvas |

### Node-Level RBAC Implementation

LIGMA implements **Role-Based Access Control** at the node level for granular permissions.

#### Permission Model

```typescript
// Permission levels
enum Permission {
  VIEW = 'view',
  EDIT = 'edit',
  COMMENT = 'comment',
  LOCK = 'lock',
  DELETE = 'delete',
  ADMIN = 'admin'
}

// Role definitions
const roles: Record<string, Permission[]> = {
  viewer: [Permission.VIEW, Permission.COMMENT],
  editor: [Permission.VIEW, Permission.EDIT, Permission.COMMENT, Permission.LOCK],
  admin: Object.values(Permission)
};

// Node-level override
interface NodePermission {
  nodeId: string;
  userId: string;
  permission: Permission;
  expiresAt?: number;
}
```

#### Permission Check Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Request    │───▶│  Load User  │───▶│  Check      │
│  received   │    │  Roles      │    │  Canvas ACL │
└─────────────┘    └─────────────┘    └──────┬──────┘
                                             │
                           ┌─────────────────┼─────────────────┐
                           ▼                 ▼                 ▼
                    ┌─────────────┐    ┌─────────────┐   ┌─────────────┐
                    │ Node-specific│   │  Default   │   │  Permission │
                    │ override?    │   │  role perms │   │   Denied   │
                    └──────┬──────┘   └──────┬──────┘   └─────────────┘
                           │                  │
                           ▼                  ▼
                    ┌─────────────┐    ┌─────────────┐
                    │ Merge perms │───▶│   Allow     │
                    │ (most perms)│    │             │
                    └─────────────┘    └─────────────┘
```

#### Role Hierarchy

```
┌─────────────────────────────────────────────────────┐
│                     OWNER                            │
│  Full control, can delete canvas, manage roles     │
├─────────────────────────────────────────────────────┤
│                     ADMIN                            │
│  Can edit/delete any node, manage editor roles     │
├─────────────────────────────────────────────────────┤
│                     EDITOR                           │
│  Can create/edit nodes, lock nodes for editing     │
├─────────────────────────────────────────────────────┤
│                     VIEWER                           │
│  Can view canvas, leave comments                   │
└─────────────────────────────────────────────────────┘
```

### AI Intent Extraction Approach

LIGMA features an AI assistant that interprets natural language commands and converts them into canvas operations.

#### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      AI Intent Pipeline                          │
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│  │ Natural  │───▶│  Intent  │───▶│  Entity  │───▶│  Action  │ │
│  │ Language │    │  Parse   │    │ Extract  │    │ Generate │ │
│  │  Input   │    │          │    │          │    │          │ │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘ │
│                                                                  │
│  Example: "Create a red circle at the center"                   │
│                                                                  │
│  Intent: CREATE_NODE                                             │
│  Entity: { type: "ellipse", style: { fill: "red" },            │
│            position: "center" }                                 │
│  Action: { type: "NODE_ADDED", payload: {...} }                │
└─────────────────────────────────────────────────────────────────┘
```

#### Intent Types

| Intent | Description | Example |
|--------|-------------|---------|
| `CREATE_NODE` | Add new node to canvas | "Add a blue rectangle" |
| `MODIFY_NODE` | Change node properties | "Make it bigger" |
| `MOVE_NODE` | Change node position | "Move it to the top left" |
| `DELETE_NODE` | Remove node from canvas | "Delete that circle" |
| `STYLE_NODE` | Apply styling | "Make it outlined with red" |
| `ORGANIZE` | Arrange nodes | "Align them horizontally" |
| `QUERY` | Ask about canvas state | "What shapes are on the canvas?" |

#### LLM Integration

```typescript
interface AIConfig {
  provider: 'openai' | 'anthropic' | 'ollama';
  model: string;
  temperature: number;
  maxTokens: number;

  // Prompt engineering
  systemPrompt: string;

  // Fallback handling
  fallbackEnabled: boolean;
  fallbackThreshold: number;  // Confidence threshold
}

// Example system prompt
const systemPrompt = `
You are LIGMA Assistant, helping users interact with a collaborative canvas.
Given a user message, extract the intent and entities for canvas operations.

Return JSON with:
- intent: The action type
- entities: Extracted parameters
- confidence: 0-1 confidence score
- explanation: Brief reasoning

Keep responses short and actionable.
`;
```

---

## Setup Instructions

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 20.x LTS | Required |
| npm | 10.x+ | Comes with Node.js |
| PostgreSQL | 15+ | Local or cloud |
| Redis | 7+ | For pub/sub and caching |
| Git | 2.40+ | For version control |

### Installation Steps

#### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-org/ligma.git
cd ligma

# Install root dependencies
npm install

# Install workspace dependencies
npm run install:all
```

#### 2. Environment Configuration

Create environment files in each package:

**packages/backend/.env**
```bash
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/ligma

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# AI Provider (optional)
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
# Or for Anthropic:
ANTHROPIC_API_KEY=sk-ant-...

# CORS
CORS_ORIGIN=http://localhost:3000
```

**packages/frontend/.env**
```bash
# API
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# Auth (if using external provider)
NEXT_PUBLIC_AUTH_PROVIDER=credentials
```

#### 3. Database Setup

```bash
# Navigate to backend
cd packages/backend

# Run migrations
npm run db:migrate

# Seed development data (optional)
npm run db:seed
```

#### 4. Start Development Servers

```bash
# From root directory - starts both frontend and backend
npm run dev

# Or run separately:
npm run dev:frontend  # Starts Next.js on port 3000
npm run dev:backend   # Starts Express on port 3001
```

### Running Locally

#### Development Mode

```bash
# Start everything with hot reload
npm run dev
```

Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Documentation: http://localhost:3001/api/docs

#### Production Build

```bash
# Build both packages
npm run build

# Run production server
npm start
```

### Deployment Notes for Render

LIGMA can be deployed to Render using the following configuration:

#### Backend (render.yaml)

```yaml
services:
  - type: web
    name: ligma-backend
    env: node
    region: oregon
    plan: starter
    buildCommand: cd packages/backend && npm install && npm run build
    startCommand: cd packages/backend && npm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
      - key: REDIS_URL
        sync: false
      - key: JWT_SECRET
        generateValue: true
      - key: AI_PROVIDER
        value: openai
      - key: OPENAI_API_KEY
        sync: false
```

#### PostgreSQL Database

1. Create a new PostgreSQL instance on Render
2. Note the internal connection string
3. Add `DATABASE_URL` environment variable

#### Redis

1. Create a new Redis instance on Render
2. Note the connection string
3. Add `REDIS_URL` environment variable

#### Frontend (render.yaml)

```yaml
services:
  - type: web
    name: ligma-frontend
    env: node
    region: oregon
    plan: starter
    buildCommand: cd packages/frontend && npm install && npm run build
    startCommand: cd packages/frontend && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: NEXT_PUBLIC_API_URL
        fromService:
          type: web
          name: ligma-backend
          envVarKey: RENDER_EXTERNAL_URL
      - key: NEXT_PUBLIC_WS_URL
        fromService:
          type: web
          name: ligma-backend
          envVarKey: RENDER_EXTERNAL_URL
```

#### Environment Variable Sync

On Render dashboard, configure environment variable sync between services or use Render's reference syntax:
```
${ligma-backend.url}
```

---

## API Endpoints

### REST Endpoints

#### Canvas Operations

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/canvases` | List user's canvases | Required |
| `POST` | `/api/canvases` | Create new canvas | Required |
| `GET` | `/api/canvases/:id` | Get canvas details | Required |
| `PATCH` | `/api/canvases/:id` | Update canvas settings | Editor+ |
| `DELETE` | `/api/canvases/:id` | Delete canvas | Owner |

#### Node Operations

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/canvases/:id/nodes` | Get all nodes | Required |
| `POST` | `/api/canvases/:id/nodes` | Create node | Editor+ |
| `PATCH` | `/api/canvases/:id/nodes/:nodeId` | Update node | Editor+ |
| `DELETE` | `/api/canvases/:id/nodes/:nodeId` | Delete node | Editor+ |
| `POST` | `/api/canvases/:id/nodes/batch` | Batch create nodes | Editor+ |

#### User & Permissions

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/canvases/:id/permissions` | List permissions | Editor+ |
| `POST` | `/api/canvases/:id/permissions` | Add permission | Admin+ |
| `PATCH` | `/api/canvases/:id/permissions/:userId` | Update permission | Admin+ |
| `DELETE` | `/api/canvases/:id/permissions/:userId` | Remove permission | Admin+ |

#### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/auth/register` | Register new user | None |
| `POST` | `/api/auth/login` | Login user | None |
| `POST` | `/api/auth/logout` | Logout user | Required |
| `GET` | `/api/auth/me` | Get current user | Required |
| `POST` | `/api/auth/refresh` | Refresh token | Required |

#### AI Assistant

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/ai/intent` | Parse user intent | Required |
| `POST` | `/api/ai/execute` | Execute AI action | Required |
| `GET` | `/api/ai/suggestions` | Get suggestions | Required |

### WebSocket Events Reference

#### Client-to-Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `join-canvas` | `{ canvasId: string }` | Join a canvas room |
| `leave-canvas` | `{ canvasId: string }` | Leave a canvas room |
| `node-update` | `{ nodeId: string, changes: Partial<NodeData> }` | Update a node |
| `cursor-move` | `{ position: { x, y } }` | Update cursor position |
| `selection-change` | `{ nodeIds: string[] }` | Change selection |
| `request-sync` | `{ lastSync: number }` | Request full sync |
| `lock-node` | `{ nodeId: string }` | Lock node for editing |
| `unlock-node` | `{ nodeId: string }` | Release node lock |

#### Server-to-Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `canvas-joined` | `{ canvas: CanvasData, nodes: NodeData[] }` | Canvas state on join |
| `node-changed` | `{ nodeId: string, changes: Partial<NodeData>, userId: string }` | Node updated |
| `node-added` | `{ node: NodeData, userId: string }` | New node created |
| `node-deleted` | `{ nodeId: string, userId: string }` | Node deleted |
| `cursor-updated` | `{ userId: string, position: { x, y }, color: string }` | Cursor moved |
| `user-joined` | `{ user: User, role: Role }` | User joined canvas |
| `user-left` | `{ userId: string }` | User left canvas |
| `lock-acquired` | `{ nodeId: string, userId: string }` | Node locked |
| `lock-released` | `{ nodeId: string }` | Node unlocked |
| `error` | `{ code: string, message: string }` | Error occurred |
| `sync-complete` | `{ timestamp: number }` | Full sync completed |

---

## Event Schema

### Core Event Types

#### NODE_ADDED

```typescript
interface NodeAddedEvent {
  type: 'NODE_ADDED';
  canvasId: string;
  userId: string;
  timestamp: number;
  vectorClock: Record<string, number>;
  payload: {
    node: NodeData;
  };
  metadata: EventMetadata;
}
```

#### NODE_UPDATED

```typescript
interface NodeUpdatedEvent {
  type: 'NODE_UPDATED';
  canvasId: string;
  userId: string;
  timestamp: number;
  vectorClock: Record<string, number>;
  payload: {
    nodeId: string;
    changes: Partial<NodeData>;
    previousValues: Partial<NodeData>;  // For rollback
  };
  metadata: EventMetadata;
}
```

#### NODE_DELETED

```typescript
interface NodeDeletedEvent {
  type: 'NODE_DELETED';
  canvasId: string;
  userId: string;
  timestamp: number;
  vectorClock: Record<string, number>;
  payload: {
    nodeId: string;
    deletedNode: NodeData;  // Stored for potential recovery
  };
  metadata: EventMetadata;
}
```

#### NODE_MOVED

```typescript
interface NodeMovedEvent {
  type: 'NODE_MOVED';
  canvasId: string;
  userId: string;
  timestamp: number;
  vectorClock: Record<string, number>;
  payload: {
    nodeId: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
  };
  metadata: EventMetadata;
}
```

#### LAYER_CHANGED

```typescript
interface LayerChangedEvent {
  type: 'LAYER_CHANGED';
  canvasId: string;
  userId: string;
  timestamp: number;
  vectorClock: Record<string, number>;
  payload: {
    action: 'reorder' | 'add' | 'remove';
    nodeId: string;
    newIndex: number;
    oldIndex?: number;
  };
  metadata: EventMetadata;
}
```

#### CANVAS_CREATED

```typescript
interface CanvasCreatedEvent {
  type: 'CANVAS_CREATED';
  canvasId: string;
  userId: string;
  timestamp: number;
  vectorClock: Record<string, number>;
  payload: {
    canvas: {
      id: string;
      name: string;
      width: number;
      height: number;
      background: string;
    };
  };
  metadata: EventMetadata;
}
```

### Event Metadata

```typescript
interface EventMetadata {
  sessionId: string;
  clientId: string;
  clientVersion: string;
  ipAddress?: string;
  userAgent?: string;
}
```

### Vector Clock

```typescript
interface VectorClock {
  [nodeId: string]: number;
}

// Example
{
  "user-123": 5,
  "user-456": 3,
  "user-789": 7
}
```

### Common Types

```typescript
interface NodeData {
  id: string;
  type: 'rectangle' | 'ellipse' | 'text' | 'image' | 'line' | 'arrow' | 'group';
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation: number;
  style: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    fontSize?: number;
    fontFamily?: string;
    textAlign?: 'left' | 'center' | 'right';
    cornerRadius?: number;
  };
  content?: string;
  parentId?: string;
  childIds?: string[];
  zIndex: number;
  lockedBy?: string;
  lockedAt?: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  vectorClock: VectorClock;
}

interface CanvasData {
  id: string;
  name: string;
  width: number;
  height: number;
  background: string;
  thumbnail?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  permissions: Permission[];
}

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: number;
}

interface Permission {
  userId: string;
  role: 'viewer' | 'editor' | 'admin' | 'owner';
  nodeOverrides?: NodePermission[];
}

interface NodePermission {
  nodeId: string;
  permission: 'view' | 'edit' | 'lock' | 'delete';
  expiresAt?: number;
}
```

### Event Validation Schema

```typescript
// JSON Schema for event validation
const eventSchema = {
  type: 'object',
  required: ['type', 'canvasId', 'userId', 'timestamp', 'payload', 'metadata'],
  properties: {
    type: {
      type: 'string',
      enum: ['NODE_ADDED', 'NODE_UPDATED', 'NODE_DELETED', 'NODE_MOVED',
             'LAYER_CHANGED', 'CANVAS_CREATED', 'CANVAS_ARCHIVED']
    },
    canvasId: { type: 'string', format: 'uuid' },
    userId: { type: 'string', format: 'uuid' },
    timestamp: { type: 'number' },
    vectorClock: {
      type: 'object',
      additionalProperties: { type: 'number' }
    },
    payload: { type: 'object' },
    metadata: {
      type: 'object',
      required: ['sessionId', 'clientId'],
      properties: {
        sessionId: { type: 'string' },
        clientId: { type: 'string' },
        clientVersion: { type: 'string' },
        ipAddress: { type: 'string' },
        userAgent: { type: 'string' }
      }
    }
  }
};
```

---

## License

MIT License - See LICENSE file for details.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.
