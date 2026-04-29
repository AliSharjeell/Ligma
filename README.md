# LIGMA - Let's Integrate Groups, Manage Anything

A real-time collaborative workspace that bridges ideation and execution. Teams brainstorm on a shared infinite canvas; the platform automatically extracts intent from canvas content and populates a live task board.

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
- **Element Grouping** - Select multiple elements, press Ctrl+G to group; all members move together

### Bonus Features

- **Presence Heatmap** - Visual overlay showing most-active canvas zones
- **Time-Travel Replay** - Scrub through session history step by step
- **AI Summary Export** - One-click export to structured markdown/JSON
- **Presence Zones** - Named focus areas showing active team members

## Quick Start

```bash
# Install dependencies
npm install

# Run both frontend and backend
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## Architecture

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Zustand State Store                             │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │  Elements   │  │   Users     │  │   Tasks     │  │   Events    │ │   │
│  │  │  (Canvas)   │  │ (Presence)  │  │ (TaskBoard) │  │ (Event Log) │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  └──────────────────────────────────┬───────────────────────────────────┘   │
│                                     │                                      │
│  ┌─────────────────────────────────┴───────────────────────────────────┐   │
│  │                  ClientOT (Operational Transformation)               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │   │
│  │  │  InsertOp   │  │  DeleteOp   │  │ VectorClock │                  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │   │
│  └──────────────────────────────────┬───────────────────────────────────┘   │
│                                     │                                      │
│  ┌─────────────────────────────────┴───────────────────────────────────┐   │
│  │                   React Components (Canvas, Panels)                  │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │   │
│  │  │ Canvas  │  │ Toolbar │  │  Task   │  │Comment  │  │ Presence│   │   │
│  │  │         │  │         │  │ Board   │  │ Panel   │  │  Zone   │   │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ WebSocket (Socket.io)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SERVER (Node.js)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Socket.io Server                                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │Room Manager │  │User Presence│  │ Event Router│  │  AI Layer   │ │   │
│  │  │             │  │             │  │             │  │ (IntentExt) │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  └──────────────────────────────────┬───────────────────────────────────┘   │
│                                     │                                      │
│  ┌──────────────────────────────────┼───────────────────────────────────┐ │
│  │                         Services Layer                                │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │ │
│  │  │  CRDT       │  │   Event     │  │   RBAC      │  │ Persistence │ │ │
│  │  │  Manager    │  │   Store     │  │   Service   │  │  Service    │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │ │
│  └──────────────────────────────────┴───────────────────────────────────┘ │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          Data Layer                                  │   │
│  │  ┌───────────────────────────────────┐  ┌───────────────────────────┐ │   │
│  │  │       In-Memory Event Store       │  │     Socket.io Store       │ │   │
│  │  │   (Append-Only Event Log)          │  │    (Room Management)      │ │   │
│  │  └───────────────────────────────────┘  └───────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
packages/frontend/src/
├── app/
│   ├── page.tsx                 # Landing / room creation
│   └── room/[id]/page.tsx      # Canvas room
├── components/
│   ├── canvas/
│   │   ├── InfiniteCanvas.tsx   # Main canvas (pan, zoom, elements)
│   │   ├── CursorPresence.tsx    # Live cursors
│   │   ├── PresenceHeatmap.tsx  # Activity zones overlay
│   │   ├── PresenceZones.tsx    # Named focus areas
│   │   ├── TimeTravel.tsx       # History replay slider
│   │   ├── CommentsOverlay.tsx   # Comment pins & threads
│   │   └── elements/
│   │       ├── TextBlock.tsx     # Editable text (OT sync)
│   │       ├── StickyNote.tsx    # Sticky notes
│   │       ├── Shape.tsx         # Vector shapes
│   │       └── Drawing.tsx       # Freehand drawings
│   ├── panels/
│   │   ├── TaskBoard.tsx         # Intent-tagged tasks
│   │   ├── CommentsPanel.tsx     # Thread view
│   │   ├── LayersPanel.tsx       # Group management
│   │   └── SummaryExport.tsx     # AI export
│   └── toolbar/
│       └── Toolbar.tsx           # Tool selection
├── crdt/
│   └── ClientOT.ts              # Client-side OT implementation
├── contexts/
│   └── socket-context.tsx        # WebSocket provider
└── store/
    └── canvas-store.ts          # Zustand state

packages/backend/src/
├── socket/
│   └── SocketHandler.ts          # WebSocket handlers & room routing
├── events/
│   ├── EventStore.ts            # Append-only event log
│   ├── EventBus.ts              # Event pub/sub
│   ├── StateReconstructor.ts    # Rebuild state from events
│   └── types.ts                 # Event definitions
├── crdt/
│   ├── CRDTManager.ts           # Server-side CRDT
│   ├── OperationalTransform.ts  # OT algorithms
│   └── VectorClock.ts           # Vector clock utilities
├── rbac/
│   ├── RBACService.ts           # Role-based access
│   └── NodeACL.ts               # Per-node permissions
├── ai/
│   └── IntentExtractor.ts       # Intent classification
└── store/
    └── PersistenceService.ts    # JSON file persistence
```

---

## Technical Choices Explained

### 1. Conflict Resolution: Operational Transformation (OT)

**Problem:** When two users simultaneously edit the same text node, how do we merge their changes without data loss or conflicts?

**Solution:** Operational Transformation with Vector Clocks

```
Timeline:
──────────────────────────────────────────────────────────────────────────►
      │
      │ User A types "Design the API"
      │     │
      │     ├─► insert('D') at 0 ──────────────────► Client B sees "D"
      │     │                                               ▲
      │     │                                               │ (transformed)
      │     │                                               │
      │     └─► insert('esign the API') at 1 ◄─────────────┘
      │
      │ User B types "Architecture"
      │     │
      │     ├─► insert('A') at 0 ──────────────────► Client A sees "A"
      │     │                                               ▲
      │     │                                               │ (transformed)
      │     │                                               │
      │     └─► insert('rchitecture') at 1 ◄──────────────┘
      │
      ▼
Both clients converge to: "Design the Architecture API"
```

**Key Insight:** OT transforms operations against each other based on causality. If neither operation causally depends on the other (detected via vector clocks), they're concurrent and need transformation.

**Transformation Rules:**

```typescript
// Insert vs Insert
if (opA.type === 'insert' && opB.type === 'insert') {
  // If B inserted before A's position, shift A forward
  if (opB.position <= opA.position && opB.text) {
    transformed.position += opB.text.length;
  }
}

// Delete vs Insert
if (opA.type === 'delete' && opB.type === 'insert') {
  // If B inserted before A's delete position, shift A forward
  if (opB.position < opA.position) {
    transformed.position += opB.text?.length || 0;
  }
}
```

**Why OT over CRDT for text?**
- OT allows server-authoritative operation ordering
- Better for moderate concurrency (2-10 simultaneous editors)
- Text transformation is well-studied with proven algorithms
- Trade-off: Server dependency for operation ordering

### 2. State Management: Event Sourcing

**Problem:** How do we maintain complete history for audit, replay, and time-travel features?

**Solution:** Append-Only Event Store

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Event Store (Immutable)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Event #1: NodeCreated                                               │
│  { id: "evt-1", type: "NodeCreated", nodeId: "node-1",              │
│    nodeType: "sticky", position: {x:100, y:200} }                  │
│                                                                      │
│  Event #2: NodeUpdated                                               │
│  { id: "evt-2", type: "NodeUpdated", nodeId: "node-1",              │
│    changes: { content: "Design the API" } }                         │
│                                                                      │
│  Event #3: NodeUpdated                                               │
│  { id: "evt-3", type: "NodeUpdated", nodeId: "node-1",              │
│    changes: { intentTag: { type: "action_item", confidence: 0.9 } } │
│                                                                      │
│  Event #4: NodeDeleted                                               │
│  { id: "evt-4", type: "NodeDeleted", nodeId: "node-1" }             │
│                                                                      │
│  NOTE: Event #4 does NOT remove event history.                       │
│        State is reconstructed by replaying events 1→4.              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**State Reconstruction:**

```typescript
class StateReconstructor {
  reconstruct(canvasId: string, events: Event[]): CanvasState {
    const nodes = new Map<string, NodeState>();

    for (const event of events) {
      switch (event.type) {
        case 'NodeCreated':
          // Add new node to map
          nodes.set(event.nodeId, createNode(event));
          break;

        case 'NodeUpdated':
          // Apply changes to existing node
          const node = nodes.get(event.nodeId);
          if (node) {
            node.content = event.changes.content ?? node.content;
            node.position = event.changes.position ?? node.position;
            node.version = event.version;
          }
          break;

        case 'NodeDeleted':
          // Mark as deleted (don't remove from history!)
          nodes.delete(event.nodeId);
          break;
      }
    }

    return { canvasId, nodes };
  }
}
```

**Benefits:**
1. **Complete Audit Trail:** Every mutation is preserved forever
2. **Time-Travel Replay:** Reconstruct canvas at any timestamp
3. **Eventual Consistency:** Missed events replayed on reconnect
4. **Temporal Queries:** "Show changes by User X in last hour"

### 3. Real-Time Communication: Socket.io

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Room-Based Broadcasting                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│    ┌─────────┐         WebSocket          ┌─────────────────────┐   │
│    │Client A │◄──────────────────────────►│                     │   │
│    └─────────┘                            │   Socket.io Server  │   │
│                                           │                     │   │
│    ┌─────────┐         WebSocket          │  ┌───────────────┐  │   │
│    │Client B │◄──────────────────────────►│  │  Room: room-1 │  │   │
│    └─────────┘                            │  │  - Client A    │  │   │
│                                           │  │  - Client B    │  │   │
│    ┌─────────┐         WebSocket          │  │  - Client C    │  │   │
│    │Client C │◄──────────────────────────►│  └───────────────┘  │   │
│    └─────────┘                            └─────────────────────┘   │
│                                                                      │
│    Operations broadcast to room-1 only, not to other rooms.          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Delta Broadcasting Pattern:**

Instead of full state sync, we broadcast only deltas:

```typescript
// On element update
socket.to(roomId).emit('node_updated', {
  nodeId: element.id,
  changes: {
    position: { x: 100, y: 200 }  // Only changed fields
  },
  version: 5,
  timestamp: Date.now()
});
```

**Reconnection Flow:**

```typescript
// Client reconnect handler
socket.on('connect', async () => {
  // 1. Get last known event ID
  const lastEventId = localStorage.getItem('lastEventId');

  // 2. Request missed events from server
  const missedEvents = await fetch(`/api/events?since=${lastEventId}`);

  // 3. Replay events to catch up
  for (const event of missedEvents) {
    applyEvent(event);
  }

  // 4. Re-register with room
  socket.emit('rejoin_room', { roomId, userId });
});
```

### 4. Role-Based Access Control (RBAC)

**Role Hierarchy:**

| Role | Create | Edit Unlocked | Edit Locked | Lock | Delete | Change Roles |
|------|--------|--------------|-------------|------|--------|--------------|
| **Lead** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Contributor** | ✓ | ✓ | ✗ | ✗ | Own only | ✗ |
| **Viewer** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

**Node-Level Locking:**

```typescript
interface NodeLock {
  nodeId: string;
  lockedBy: string;        // User ID
  lockedByName: string;   // Display name
  lockedAt: number;       // Timestamp
  lockExpiry?: number;    // Auto-unlock (optional)
}
```

**Enforcement Points:**

```
User Action ──┬──► Client-Side UI (disabled buttons)
               │
               └──► Server-Side Validation (mandatory)
                        │
                        ▼
              ┌──────────────────────┐
              │    RBAC Service       │
              ├──────────────────────┤
              │ 1. Authenticated?     │──► 401 Unauthorized
              │ 2. Role permits?      │──► 403 Forbidden
              │ 3. Node locked?       │──► 423 Locked
              │ 4. Is owner?          │──► (for delete)
              └──────────────────────┘
                        │
                        ▼
                   Allow / Reject
```

### 5. AI-Powered Features

LIGMA uses AI to automatically extract meaning from canvas content, generate summaries, and enable conversational interactions.

#### 5.1 Intent Classification & Task Extraction

**Problem:** How do we automatically turn brainstorm content into actionable tasks without manual copy-paste?

**Solution:** AI-powered intent classification with LLM fallback

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Intent Classification Pipeline                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  User types "TODO: Design the API by Friday"                            │
│         │                                                              │
│         ▼ (debounced 2 seconds of inactivity)                           │
│  ┌─────────────────┐                                                    │
│  │ IntentClassifier │                                                   │
│  │    (Groq API)    │                                                   │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │                    LLM Analysis                               │       │
│  │  System: "Classify as action_item, decision, open_question,  │       │
│  │           or reference"                                       │       │
│  │                                                              │       │
│  │  Input: "TODO: Design the API by Friday"                     │       │
│  │                                                              │       │
│  │  Output: {                                                   │       │
│  │    type: "action_item",                                      │       │
│  │    confidence: 0.94,                                         │       │
│  │    title: "Design the API",                                  │       │
│  │    suggestedTask: {                                          │       │
│  │      title: "Design the API",                                │       │
│  │      description: "TODO: Design the API by Friday"           │       │
│  │    }                                                         │       │
│  │  }                                                           │       │
│  └─────────────────────────────────────────────────────────────┘       │
│           │                                                             │
│           ▼                                                             │
│  Task Board ────────► Canvas Node Link                                  │
│  [ ] Design the API    nodeId: "node-42"                                │
│                        position: {x: 100, y: 200}                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Intent Types:**

| Type | Indicators | Example |
|------|------------|---------|
| `action_item` | TODO, FIXME, NEED TO, MUST, SHOULD | "TODO: Review PR by Monday" |
| `decision` | DECIDED, AGREED, APPROVED, RESOLVED | "DECIDED: Use Postgres" |
| `open_question` | ?, HOW, WHY, WHAT, WHEN | "How should we handle auth?" |
| `reference` | SEE, AS PER, MENTIONED, REFER | "See design doc" |

**Implementation:**

```typescript
// packages/backend/src/ai/IntentExtractor.ts
export class IntentClassifier {
  private cache: Map<string, ExtractedIntent> = new Map();

  async classify(content: string): Promise<ExtractedIntent> {
    // Check cache first
    const cacheKey = content.slice(0, 200).toLowerCase().trim();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Use Groq API for LLM classification
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Classify: "${content}"` }
        ],
        temperature: 0.1,
        max_tokens: 150
      })
    });

    // Parse response and return ExtractedIntent
    // ...
  }

  // Fallback regex-based classifier (when API unavailable)
  private fallbackClassify(content: string): ExtractedIntent {
    const lower = content.toLowerCase();
    if (/\b(todo|task|need to|should|must)\b/i.test(lower)) {
      return { type: 'action_item', confidence: 0.6, ... };
    }
    // ...
  }
}
```

**Task Data Structure:**

```typescript
interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed';
  assignee?: string;
  authorId: string;
  authorName: string;
  nodeId: string;              // Link back to canvas node
  canvasPosition: {x: number, y: number};
  priority: 'low' | 'medium' | 'high';
  intentType: IntentType;
  createdAt: number;
}
```

---

#### 5.2 AI Summary Generation

**Problem:** How do we quickly summarize a brainstorming session into actionable insights?

**Solution:** Canvas data → AI → Structured summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Summary Generation Pipeline                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Input Data:                                                             │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │  Elements: [sticky, sticky, text, shape, drawing]           │       │
│  │  Tasks: [action_item, decision, open_question]                │       │
│  │  Users: [Alice (Lead), Bob (Contributor)]                   │       │
│  │  Activity: [created node, moved element, typed text]          │       │
│  └─────────────────────────────────────────────────────────────┘       │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │                 SummaryGenerator (Groq API)                  │       │
│  │                                                              │       │
│  │  model: llama-3.1-8b-instant                               │       │
│  │  temperature: 0.3                                           │       │
│  │  max_tokens: 1024                                           │       │
│  │                                                              │       │
│  └─────────────────────────────────────────────────────────────┘       │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │                    Generated Summary                         │       │
│  │  {                                                           │       │
│  │    overview: "Session focused on API design...",             │       │
│  │    decisions: ["Use REST API", "Postgres for storage"],      │       │
│  │    actionItems: ["Design the API", "Write docs"],            │       │
│  │    openQuestions: ["How to handle auth?"],                   │       │
│  │    references: ["Design doc link"],                          │       │
│  │    nextSteps: ["Schedule follow-up meeting"],                 │       │
│  │    participants: ["Alice", "Bob"]                            │       │
│  │  }                                                           │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Export Formats:**

| Format | Description |
|--------|-------------|
| **JSON** | Structured data for programmatic use |
| **Markdown** | Human-readable formatted document |
| **PNG** | Visual snapshot of canvas (via html2canvas) |

---

#### 5.3 RAG Chat (Retrieval-Augmented Generation)

**Problem:** How do we let users query canvas content conversationally?

**Solution:** RAG-based chat with canvas context

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    RAG Chat Pipeline                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  User Query: "What decisions did we make today?"                        │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │                   RAG Context Assembly                        │       │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐     │       │
│  │  │ Canvas Summary │ + │ Tasks/Decisions│ + │ Recent Activity│     │       │
│  │  └───────────────┘  └───────────────┘  └───────────────┘     │       │
│  │                                                              │       │
│  │  CONTEXT:                                                     │       │
│  │  DECISIONS:                                                   │       │
│  │  - Use REST API architecture                                  │       │
│  │  - Postgres for primary storage                                │       │
│  │  ACTION ITEMS:                                                │       │
│  │  - Design the API (assigned to Alice)                         │       │
│  │  - Write documentation (pending)                              │       │
│  └─────────────────────────────────────────────────────────────┘       │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │                    Groq API (LLM)                            │       │
│  │                                                              │       │
│  │  System: "You are a helpful assistant for Ligma canvas..."  │       │
│  │  Context: [RAG assembled above]                             │       │
│  │  Query: "What decisions did we make today?"                 │       │
│  │                                                              │       │
│  └─────────────────────────────────────────────────────────────┘       │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │                    Generated Response                         │       │
│  │  "Based on the session, you made two key decisions:          │       │
│  │   1. Use REST API architecture                              │       │
│  │   2. Use Postgres for primary storage                        │       │
│  │   Both decisions are reflected in your task board."          │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Vision Capability:**

The chat also supports screenshot analysis using vision-capable models:

```typescript
// If user provides a screenshot
if (input.screenshot) {
  // Use multimodal model for vision analysis
  model: 'llama-3.2-11b-vision-preview';

  userContent: [
    { type: 'text', text: input.query },
    { type: 'image_url', image_url: { url: screenshot } }
  ];
}
```

---

#### 5.4 AI Service Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      AI Services Layer                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Groq API (External)                           │   │
│  │                    https://api.groq.com                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│         │                    │                    │                       │
│         ▼                    ▼                    ▼                       │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│  │   Intent    │     │   Summary    │     │    RAG       │            │
│  │ Classifier  │     │  Generator   │     │ Chat Service │            │
│  │             │     │              │     │              │            │
│  │ - classify()│     │ - generate() │     │ - query()    │            │
│  │ - fallback  │     │ - fallback   │     │ - vision     │            │
│  │ - cache    │     │ - cache      │     │ - context    │            │
│  └──────────────┘     └──────────────┘     └──────────────┘            │
│                                                                          │
│                         Internal Modules                                  │
│                                                                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│  │    Task     │     │   Summary    │     │   Canvas     │            │
│  │   Board     │     │   Storage    │     │   Context    │            │
│  │             │     │              │     │              │            │
│  │ - addTask() │     │ - summarize()│     │ - update()   │            │
│  │ - update() │     │ - export()   │     │ - retrieve() │            │
│  └──────────────┘     └──────────────┘     └──────────────┘            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Configuration:**

```bash
# packages/backend/.env
GROQ_API_KEY=your_groq_api_key_here
```

**Models Used:**

| Service | Model | Purpose |
|---------|-------|---------|
| Intent Classifier | `llama-3.1-8b-instant` | Fast, cheap classification |
| Summary Generator | `llama-3.1-8b-instant` | Fast summarization |
| RAG Chat | `llama-3.1-8b-instant` | Text responses |
| RAG Chat (Vision) | `llama-3.2-11b-vision-preview` | Screenshot analysis |

**Caching Strategy:**

```typescript
// All AI services include caching to reduce API calls
class Service {
  private cache: Map<string, { result: T; timestamp: number }>;
  private cacheTimeout = 60000; // 1 minute

  async cached(key: string, fn: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.result;
    }
    const result = await fn();
    this.cache.set(key, { result, timestamp: Date.now() });
    return result;
  }
}
```

**Fallback Strategy:**

Each AI service has a regex-based fallback when the API is unavailable:

```typescript
private fallbackClassify(content: string): ExtractedIntent {
  const lower = content.toLowerCase();

  if (/\b(todo|task|need to|should|must)\b/i.test(lower)) {
    return { type: 'action_item', confidence: 0.6, ... };
  }
  if (/\b(decided|agreed|approved)\b/i.test(lower)) {
    return { type: 'decision', confidence: 0.6, ... };
  }
  // ...
}
```

---

### 6. Role-Based Access Control (RBAC)

---

## Socket Events Reference

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join_room` | `{ roomId, userId, userName, role }` | Join canvas room |
| `leave_room` | `{ roomId }` | Leave room |
| `node_create` | `CanvasElement` | Create element |
| `node_update` | `CanvasElement` | Update element |
| `node_delete` | `{ nodeId }` | Delete element |
| `node_lock` | `{ nodeId }` | Lock element |
| `node_unlock` | `{ nodeId }` | Unlock element |
| `text_operation` | `Operation` | Text edit (OT) |
| `cursor_move` | `{ x: number, y: number }` | Cursor position |
| `comment_create` | `Comment` | Add comment |
| `comment_reply` | `{ commentId, content }` | Reply to comment |
| `bulk_lock` | `{ nodeIds: string[] }` | Lock multiple nodes |
| `bulk_unlock` | `{ nodeIds: string[] }` | Unlock multiple nodes |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `room_state` | `{ elements, users, events }` | Initial sync |
| `node_created` | `CanvasElement` | New element |
| `node_updated` | `CanvasElement` | Element changed |
| `node_deleted` | `{ nodeId }` | Element removed |
| `node_locked` | `{ nodeId, lockedBy }` | Element locked |
| `node_unlocked` | `{ nodeId }` | Element unlocked |
| `user_joined` | `User` | New user |
| `user_left` | `{ userId }` | User left |
| `cursor_update` | `{ userId, x, y }` | Cursor moved |
| `text_operation` | `Operation` | Text from another user |
| `nodes_locked` | `{ events[], failed[] }` | Bulk lock result |
| `nodes_unlocked` | `{ events[], failed[] }` | Bulk unlock result |
| `error` | `{ code, message }` | Error occurred |

---

## Deployment

### Backend (Render)

1. Create Web Service on Render
2. Connect GitHub repository
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Environment variables:
   - `PORT=3001`
   - `NODE_ENV=production`

### Frontend (Render)

1. Create Web Service on Render
2. Connect GitHub repository
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Environment variables:
   - `NEXT_PUBLIC_WS_URL=https://your-backend.onrender.com`

---

## How to Use

### Canvas Tools

1. **Select a tool** from the toolbar on the left
2. **Click on the canvas** to place elements
3. **Pan** by holding middle mouse button or selecting pan tool
4. **Zoom** with scroll wheel (Ctrl + scroll)

### Element Interactions

| Tool | How to Use |
|------|------------|
| Sticky Note | Click to place, double-click to edit |
| Shape | Click and drag to create shape |
| Text | Double-click to place and edit text |
| Drawing | Click and drag to freehand draw |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+G` | Group selected elements |
| `Ctrl+Shift+G` | Ungroup |
| `Delete` | Delete selected elements |
| `Ctrl+Z` | Undo |

### Task Extraction

Type keywords in any text node:
- `TODO:`, `FIXME:`, `ACTION:` → Creates action item
- `DECIDED:`, `AGREED:` → Creates decision
- `?` → Creates open question

Tasks appear automatically in the Task Board panel.

---

## License

MIT License
