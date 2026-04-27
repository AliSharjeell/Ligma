import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { CanvasElement, Position, Tool, ShapeType, Task, CanvasEvent, User, CanvasState } from '@/types/canvas';

interface HistoryEntry {
  elements: Map<string, CanvasElement>;
  timestamp: number;
}

interface CanvasStore extends CanvasState {
  setTool: (tool: Tool) => void;
  setShapeType: (shapeType: ShapeType) => void;
  setSelectedId: (id: string | null) => void;
  setSelectedIds: (ids: Set<string>) => void;
  addToSelection: (id: string) => void;
  removeFromSelection: (id: string) => void;
  clearSelection: () => void;
  toggleSelection: (id: string) => void;
  setViewportPosition: (position: Position) => void;
  setViewportZoom: (zoom: number) => void;

  addElement: (element: Omit<CanvasElement, 'id' | 'createdAt' | 'updatedAt'>) => CanvasElement;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  deleteElement: (id: string) => void;
  lockElement: (id: string) => boolean;
  unlockElement: (id: string) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  updateUserCursor: (userId: string, position: Position) => void;
  addUser: (user: User) => void;
  removeUser: (userId: string) => void;

  addTask: (task: Omit<Task, 'id'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;

  addEvent: (event: Omit<CanvasEvent, 'id' | 'timestamp' | 'userId' | 'userName'>) => void;

  getElement: (id: string) => CanvasElement | undefined;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  elements: new Map(),
  selectedIds: new Set(),
  tool: 'select',
  shapeType: 'rectangle',
  users: new Map(),
  tasks: [],
  eventLog: [],
  viewportPosition: { x: 0, y: 0 },
  viewportZoom: 1,
  userId: uuidv4(),
  userName: `User ${Math.floor(Math.random() * 1000)}`,
  history: [],
  redoStack: [],

  setTool: (tool) => set({ tool }),
  setShapeType: (shapeType) => set({ shapeType }),
  setSelectedId: (id) => set({ selectedIds: id ? new Set([id]) : new Set() }),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  addToSelection: (id) => set((state) => {
    const newSet = new Set(state.selectedIds);
    newSet.add(id);
    return { selectedIds: newSet };
  }),
  removeFromSelection: (id) => set((state) => {
    const newSet = new Set(state.selectedIds);
    newSet.delete(id);
    return { selectedIds: newSet };
  }),
  clearSelection: () => set({ selectedIds: new Set() }),
  toggleSelection: (id) => set((state) => {
    const newSet = new Set(state.selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    return { selectedIds: newSet };
  }),
  setViewportPosition: (viewportPosition) => set({ viewportPosition }),
  setViewportZoom: (viewportZoom) => set({ viewportZoom }),

  addElement: (elementData) => {
    const { userId, userName } = get();
    const element: CanvasElement = {
      ...elementData,
      id: uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => {
      // Save current state to history before making change
      const newHistory = [...state.history, { elements: new Map(state.elements), timestamp: Date.now() }].slice(-50);
      const newElements = new Map(state.elements);
      newElements.set(element.id, element);
      return { elements: newElements, history: newHistory, redoStack: [] };
    });
    get().addEvent({
      type: 'create',
      elementId: element.id,
      details: `Created ${elementData.type}`,
    });
    return element;
  },

  updateElement: (id, updates) => {
    set((state) => {
      const element = state.elements.get(id);
      if (!element || element.locked) return state;
      // Save to history before update
      const newHistory = [...state.history, { elements: new Map(state.elements), timestamp: Date.now() }].slice(-50);
      const newElements = new Map(state.elements);
      newElements.set(id, { ...element, ...updates, updatedAt: Date.now() });
      return { elements: newElements, history: newHistory, redoStack: [] };
    });
  },

  deleteElement: (id) => {
    set((state) => {
      const newHistory = [...state.history, { elements: new Map(state.elements), timestamp: Date.now() }].slice(-50);
      const newElements = new Map(state.elements);
      newElements.delete(id);
      const newSelectedIds = new Set(state.selectedIds);
      newSelectedIds.delete(id);
      return {
        elements: newElements,
        selectedIds: newSelectedIds,
        history: newHistory,
        redoStack: [],
      };
    });
    get().addEvent({ type: 'delete', elementId: id });
  },

  lockElement: (id) => {
    const { userId } = get();
    const element = get().elements.get(id);
    if (!element || element.locked) return false;
    set((state) => {
      const newElements = new Map(state.elements);
      newElements.set(id, { ...element, locked: true, lockedBy: userId });
      return { elements: newElements };
    });
    get().addEvent({ type: 'lock', elementId: id });
    return true;
  },

  unlockElement: (id) => {
    set((state) => {
      const element = state.elements.get(id);
      if (!element) return state;
      const newElements = new Map(state.elements);
      newElements.set(id, { ...element, locked: false, lockedBy: undefined });
      return { elements: newElements };
    });
    get().addEvent({ type: 'unlock', elementId: id });
  },

  undo: () => {
    const { elements, history } = get();
    if (history.length === 0) return;

    set((state) => {
      const newHistory = [...state.history];
      const lastEntry = newHistory.pop();

      if (lastEntry) {
        // Save current state to redo stack
        const newRedoStack = [...state.redoStack, { elements: new Map(state.elements), timestamp: Date.now() }].slice(-50);
        return {
          elements: lastEntry.elements,
          history: newHistory,
          redoStack: newRedoStack,
        };
      }
      return state;
    });
  },

  redo: () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return;

    set((state) => {
      const newRedoStack = [...state.redoStack];
      const nextEntry = newRedoStack.pop();

      if (nextEntry) {
        // Save current state to history
        const newHistory = [...state.history, { elements: new Map(state.elements), timestamp: Date.now() }].slice(-50);
        return {
          elements: nextEntry.elements,
          redoStack: newRedoStack,
          history: newHistory,
        };
      }
      return state;
    });
  },

  canUndo: () => get().history.length > 0,

  canRedo: () => get().redoStack.length > 0,

  updateUserCursor: (userId, position) => {
    set((state) => {
      const newUsers = new Map(state.users);
      const user = newUsers.get(userId);
      if (user) {
        newUsers.set(userId, { ...user, cursor: position });
      }
      return { users: newUsers };
    });
  },

  addUser: (user) => {
    set((state) => {
      const newUsers = new Map(state.users);
      newUsers.set(user.id, user);
      return { users: newUsers };
    });
  },

  removeUser: (userId) => {
    set((state) => {
      const newUsers = new Map(state.users);
      newUsers.delete(userId);
      return { users: newUsers };
    });
  },

  addTask: (taskData) => {
    const task: Task = { ...taskData, id: uuidv4() };
    set((state) => ({ tasks: [...state.tasks, task] }));
  },

  updateTask: (id, updates) => {
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  },

  deleteTask: (id) => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    }));
  },

  addEvent: (eventData) => {
    const { userId, userName } = get();
    const event: CanvasEvent = {
      ...eventData,
      id: uuidv4(),
      userId,
      userName,
      timestamp: Date.now(),
    };
    set((state) => ({
      eventLog: [event, ...state.eventLog].slice(0, 100),
    }));
  },

  getElement: (id) => get().elements.get(id),
}));