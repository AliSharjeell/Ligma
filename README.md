# LIGMA - Real-Time Collaborative Workspace

A hackathon project for building a real-time collaborative workspace that bridges ideation and execution. Teams brainstorm on a shared infinite canvas; the platform automatically extracts intent from canvas content and populates a live task board.

## Features

### Core Features

- **Infinite Canvas** - Sticky notes, freehand drawing, shapes, and text blocks
- **Real-Time Collaboration** - Multiple users can edit simultaneously via WebSocket
- **CRDT Conflict Resolution** - Vector clock-based merge logic (not "last write wins")
- **Cursor Presence** - See all connected users' cursors in real-time
- **Node-Level RBAC** - Individual node locking with Lead/Contributor/Viewer roles
- **AI Intent Extraction** - Auto-classifies content as action items, decisions, questions, or references
- **Append-Only Event Log** - Immutable history of all canvas mutations
- **Task Board** - Auto-populated from canvas content with author, timestamp, and source link

### Bonus Features

- **Presence Heatmap** - Visual overlay showing most-active canvas zones
- **Time-Travel Replay** - Scrub through session history step by step
- **AI Summary Export** - One-click export to structured markdown/JSON
- **Presence Zones** - Named focus areas showing active team members

## Quick Start

```bash
# Install dependencies
npm install

# Run backend (Terminal 1)
cd packages/backend && npm run dev

# Run frontend (Terminal 2)
cd packages/frontend && npm run dev
```

Open **http://localhost:3000** in your browser.

## How to Use

### Canvas Tools

1. **Select a tool** from the toolbar on the left
2. **Click on the canvas** to place elements
3. **Pan** by holding middle mouse button or selecting pan tool
4. **Zoom** with scroll wheel

### Supported Elements

| Tool | How to Use |
|------|------------|
| Sticky Note | Click to place, edit text by clicking on it |
| Shape | Click to place (rectangle, ellipse, diamond, line) |
| Text | Click to place text block |
| Drawing | Click and drag to freehand draw |

### Task Extraction

1. Type keywords like `TODO:`, `FIXME:`, `ACTION:`, `DECISION:`, or `?` on any sticky note
2. Tasks automatically appear in the **Tasks** panel
3. Click tasks to navigate back to the source node

### Role-Based Access

- **Lead** - Full control including locking nodes
- **Contributor** - Can edit and create
- **Viewer** - Read-only access

### Bonus Feature Toggles

Click the icons in the toolbar to toggle:
- **Activity** (Heatmap) - Show cursor activity zones
- **Map** (Zones) - Show named focus areas
- **History** (Time Travel) - Replay session history

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
│   Browser (User A) ─── Browser (User B) ─── Browser (User C)│
└─────────────────────────────┬───────────────────────────────┘
                              │ WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    NEXT.JS FRONTEND                          │
│   Canvas │ Toolbar │ Task Board │ Presence │ Time Travel     │
└─────────────────────────────┬───────────────────────────────┘
                              │ HTTP + WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    NODE.JS BACKEND                           │
│   Express │ Socket.io │ Event Store │ RBAC │ AI Parser      │
└─────────────────────────────────────────────────────────────┘
```

### Key Technical Decisions

**CRDT Strategy:**
- Vector clocks track causal ordering of events
- Concurrent edits merge based on timestamp ordering
- Server acts as single source of truth

**Event Sourcing:**
- Every mutation stored as immutable event
- Events replayable to reconstruct state at any point
- Enables time-travel and audit trail

**WebSocket Delta Broadcasting:**
- Only changed elements broadcast (not full state)
- Reconnection replays missed events
- Room-based routing per canvas

## Tech Stack

### Frontend
- Next.js 14 (App Router)
- React 18
- TailwindCSS + shadcn/ui
- Zustand (state management)
- Socket.io-client

### Backend
- Node.js
- Express
- Socket.io
- TypeScript

## Project Structure

```
packages/
├── frontend/
│   └── src/
│       ├── app/           # Next.js pages
│       ├── components/
│       │   ├── canvas/    # Canvas, elements, cursor
│       │   ├── toolbar/  # Tool selection
│       │   └── panels/   # Task board, export
│       ├── contexts/      # Socket provider
│       ├── store/        # Zustand stores
│       └── types/        # TypeScript types
└── backend/
    └── src/
        ├── index.ts      # Server entry
        ├── socket/      # WebSocket handlers
        ├── events/      # Event store
        ├── rbac/         # Permission checks
        └── ai/          # Intent parsing
```

## Socket Events

### Client → Server
| Event | Description |
|-------|-------------|
| `join_room` | Join a canvas room |
| `leave_room` | Leave current room |
| `element_create` | Create new element |
| `element_update` | Update element |
| `element_delete` | Delete element |
| `cursor_move` | Update cursor position |
| `lock_element` | Lock element for editing |
| `unlock_element` | Release lock |

### Server → Client
| Event | Description |
|-------|-------------|
| `room_joined` | Confirmed room join |
| `element_created` | New element broadcast |
| `element_updated` | Element changed |
| `element_deleted` | Element removed |
| `cursor_updated` | Cursor position changed |
| `presence_update` | User joined/left |
| `error` | Error occurred |

## Deployment on Render

### Backend Setup
1. Create Web Service on Render
2. Connect GitHub repo
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Set environment variable: `PORT=3001`

### Frontend Setup
1. Create Web Service on Render
2. Connect GitHub repo
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Set environment variable: `NEXT_PUBLIC_WS_URL=https://your-backend.onrender.com`
6. Add redirect rule: `/` → `/`

## API Reference

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/events` | Get event history |
| `POST` | `/api/events/snapshot` | Create snapshot |

### WebSocket Connection

```javascript
const socket = io('http://localhost:3001', {
  auth: { roomId: 'canvas-id', userId: 'user-id' }
});
```

## Evaluation Criteria

This project addresses all hackathon requirements:

| Category | Requirement | Implementation |
|----------|-------------|----------------|
| Real-Time Collab | Multi-user sync | WebSocket + delta broadcast |
| Conflict Resolution | Not "last write wins" | Vector clock merge |
| Cursor Presence | Visible cursors | Real-time cursor tracking |
| AI Intent Extraction | Auto task creation | Rule-based classifier |
| Node RBAC | Per-node permissions | Server-side permission checks |
| Event Sourcing | Immutable log | Append-only event store |
| Time Travel | History replay | Event reconstruction |
| UI/UX | Functional canvas | Infinite canvas + toolbar |

## License

MIT License
