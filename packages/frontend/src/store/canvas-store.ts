import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { CanvasElement, Position, Tool, ShapeType, Task, CanvasEvent, User, CanvasState } from '@/types/canvas';

interface HistoryEntry {
  elements: Map<string, CanvasElement>;
  timestamp: number;
}

interface CanvasStore extends CanvasState {
  userRole: 'Lead' | 'Contributor' | 'Viewer';
  setUserRole: (role: 'Lead' | 'Contributor' | 'Viewer') => void;
  setUserName: (name: string) => void;
  setTool: (tool: Tool) => void;
  setShapeType: (shapeType: ShapeType) => void;
  setDrawColor: (color: string) => void;
  setShapeColor: (color: string) => void;
  setStickyColor: (color: string) => void;
  setTextColor: (color: string) => void;
  setTextFontSize: (size: number) => void;
  setTextFontFamily: (family: string) => void;
  setTextFontWeight: (weight: 'normal' | 'bold' | number) => void;
  setTextAlign: (align: 'left' | 'center' | 'right') => void;
  setPresenceHeatmapEnabled: (enabled: boolean) => void;
  setPresenceZonesEnabled: (enabled: boolean) => void;
  setTimeTravelEnabled: (enabled: boolean) => void;
  setSelectedId: (id: string | null) => void;
  setSelectedIds: (ids: Set<string>) => void;
  addToSelection: (id: string) => void;
  removeFromSelection: (id: string) => void;
  clearSelection: () => void;
  toggleSelection: (id: string) => void;
  setViewportPosition: (position: Position) => void;
  setViewportZoom: (zoom: number) => void;

  addElement: (element: Omit<CanvasElement, 'id' | 'createdAt' | 'updatedAt'>) => CanvasElement;
  addRemoteElement: (element: CanvasElement) => void;
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
  addRemoteTask: (task: Task) => void;
  setTasks: (tasks: Task[]) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  addRemoteEvent: (event: CanvasEvent) => void;
  setEventLog: (events: CanvasEvent[]) => void;
  setElements: (elements: CanvasElement[]) => void;
  setUsers: (users: User[]) => void;

  getElement: (id: string) => CanvasElement | undefined;
  resetCanvas: () => void;
  persistElements: (roomId?: string) => void;
  loadElements: (roomId?: string) => void;
}

const getElementsKey = (roomId?: string) => `ligma-canvas-${roomId || 'default'}`;

const saveElementsToStorage = (elements: Map<string, CanvasElement>, roomId?: string) => {
  if (typeof window !== 'undefined') {
    try {
      const arr = Array.from(elements.values());
      console.log('Saving', arr.length, 'elements to localStorage for room:', roomId);
      localStorage.setItem(getElementsKey(roomId), JSON.stringify(arr));
    } catch (e) {
      console.error('Failed to save elements:', e);
    }
  }
};

const loadElementsFromStorage = (roomId?: string): CanvasElement[] => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(getElementsKey(roomId));
      console.log('Loading elements from localStorage for room:', roomId);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to load elements:', e);
      return [];
    }
  }
  return [];
};

const getInitialUserName = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('ligma-username') || `User ${Math.floor(Math.random() * 1000)}`;
  }
  return 'User';
};

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  elements: new Map(),
  selectedIds: new Set(),
  tool: 'select',
  shapeType: 'rectangle',
  drawColor: '#1f2937',
  shapeColor: '#374151',
  stickyColor: '#fef08a',
  textColor: '#1f2937',
  textFontSize: 20,
  textFontFamily: 'var(--font-handwritten), cursive',
  textFontWeight: 'normal',
  textAlign: 'left',
  presenceHeatmapEnabled: false,
  presenceZonesEnabled: false,
  timeTravelEnabled: false,
  users: new Map(),
  userRole: 'Viewer',
  tasks: [],
  eventLog: [],
  viewportPosition: { x: 0, y: 0 },
  viewportZoom: 1,
  userId: uuidv4(),
  userName: getInitialUserName(),
  history: [],
  redoStack: [],

  setUserRole: (userRole) => set({ userRole }),
  setUserName: (name) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ligma-username', name);
    }
    set({ userName: name });
  },
  setTool: (tool) => set({ tool }),
  setShapeType: (shapeType) => set({ shapeType }),
  setDrawColor: (color) => set({ drawColor: color }),
  setShapeColor: (color) => set({ shapeColor: color }),
  setStickyColor: (color) => set({ stickyColor: color }),
  setTextColor: (color) => set({ textColor: color }),
  setTextFontSize: (size) => set({ textFontSize: size }),
  setTextFontFamily: (family) => set({ textFontFamily: family }),
  setTextFontWeight: (weight) => set({ textFontWeight: weight }),
  setTextAlign: (align) => set({ textAlign: align }),
  setPresenceHeatmapEnabled: (enabled) => set({ presenceHeatmapEnabled: enabled }),
  setPresenceZonesEnabled: (enabled) => set({ presenceZonesEnabled: enabled }),
  setTimeTravelEnabled: (enabled) => set({ timeTravelEnabled: enabled }),
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
      saveElementsToStorage(newElements);
      return { elements: newElements, history: newHistory, redoStack: [] };
    });
    return element;
  },

  addRemoteElement: (element) => {
    set((state) => {
      if (state.elements.has(element.id)) {
        return state;
      }
      const newElements = new Map(state.elements);
      newElements.set(element.id, element);
      return { elements: newElements };
    });
  },

  updateElement: (id, updates) => {
    set((state) => {
      const element = state.elements.get(id);
      const { userId } = get();
      if (!element) return state;
      if (element.locked && element.lockedBy !== userId) return state;
      // Save to history before update
      const newHistory = [...state.history, { elements: new Map(state.elements), timestamp: Date.now() }].slice(-50);
      const newElements = new Map(state.elements);
      newElements.set(id, { ...element, ...updates, updatedAt: Date.now() });
      saveElementsToStorage(newElements);
      return { elements: newElements, history: newHistory, redoStack: [] };
    });
  },

  deleteElement: (id) => {
    set((state) => {
      const newHistory = [...state.history, { elements: new Map(state.elements), timestamp: Date.now() }].slice(-50);
      const newElements = new Map(state.elements);
      newElements.delete(id);
      saveElementsToStorage(newElements);
      const newSelectedIds = new Set(state.selectedIds);
      newSelectedIds.delete(id);
      return {
        elements: newElements,
        selectedIds: newSelectedIds,
        history: newHistory,
        redoStack: [],
      };
    });
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

  addRemoteTask: (task) => {
    set((state) => {
      if (state.tasks.some((existing) => existing.id === task.id)) {
        return state;
      }
      return { tasks: [task, ...state.tasks] };
    });
  },

  setTasks: (tasks) => {
    set({ tasks });
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

  addRemoteEvent: (event) => {
    set((state) => {
      if (state.eventLog.some((existing) => existing.id === event.id)) {
        return state;
      }
      const next = [event, ...state.eventLog].slice(0, 100);
      return { eventLog: next };
    });
  },

  setEventLog: (events) => {
    const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
    set({ eventLog: sorted });
  },

  setElements: (elements) => {
    const newElements = new Map<string, CanvasElement>();
    elements.forEach((el) => newElements.set(el.id, el));
    console.log('setElements called with', elements.length, 'elements');
    set({ elements: newElements });
  },

  setUsers: (users) => {
    const newUsers = new Map<string, User>();
    users.forEach((u) => newUsers.set(u.id, u));
    set({ users: newUsers });
  },

  getElement: (id) => get().elements.get(id),

  persistElements: (roomId) => {
    saveElementsToStorage(get().elements, roomId);
  },

  loadElements: (roomId) => {
    const saved = loadElementsFromStorage(roomId);
    if (saved.length > 0) {
      const newElements = new Map<string, CanvasElement>();
      saved.forEach((el) => newElements.set(el.id, el));
      set({ elements: newElements });
    }
  },

  resetCanvas: () => set({
    elements: new Map(),
    selectedIds: new Set(),
    users: new Map(),
    tasks: [],
    eventLog: [],
    history: [],
    redoStack: [],
  }),
}));