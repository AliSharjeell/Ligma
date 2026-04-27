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
  selectedId: null,
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
  setSelectedId: (selectedId) => set({ selectedId }),
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
      const newElements = new Map(state.elements);
      newElements.set(element.id, element);
      return { elements: newElements };
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
      const newElements = new Map(state.elements);
      newElements.set(id, { ...element, ...updates, updatedAt: Date.now() });
      return { elements: newElements };
    });
  },

  deleteElement: (id) => {
    set((state) => {
      const newElements = new Map(state.elements);
      newElements.delete(id);
      return {
        elements: newElements,
        selectedId: state.selectedId === id ? null : state.selectedId,
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
    const { elements } = get();
    if (elements.size === 0) return;
    const snapshot: HistoryEntry = {
      elements: new Map(elements),
      timestamp: Date.now(),
    };
    set((state) => {
      if (state.history.length === 0) return state;
      const newHistory = [...state.history];
      const lastEntry = newHistory.pop();
      if (lastEntry) {
        return { elements: lastEntry.elements, history: newHistory };
      }
      return state;
    });
  },

  redo: () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return;
    set((state) => {
      if (state.redoStack.length === 0) return state;
      const newRedoStack = [...state.redoStack];
      const nextEntry = newRedoStack.pop();
      if (nextEntry) {
        return {
          elements: nextEntry.elements,
          redoStack: newRedoStack,
        };
      }
      return state;
    });
  },

  canUndo: () => get().elements.size > 0,

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