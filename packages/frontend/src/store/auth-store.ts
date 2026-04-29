import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'ligma-auth';

// Simple hash function for password storage (hackathon only - not secure)
const hashPassword = (password: string): string => {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
};

interface AuthUser {
  userId: string;
  username: string;
  passwordHash: string;
}

interface AuthStore {
  userId: string | null;
  username: string | null;
  isAuthenticated: boolean;
  signUp: (username: string, password: string) => { success: boolean; error?: string };
  signIn: (username: string, password: string) => { success: boolean; error?: string };
  signOut: () => void;
  getCurrentUser: () => { userId: string | null; username: string | null } | null;
}

const getStoredAuth = (): AuthUser | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    console.error('Failed to read auth from storage:', e);
    return null;
  }
};

const saveAuthToStorage = (auth: AuthUser) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  } catch (e) {
    console.error('Failed to save auth to storage:', e);
  }
};

const clearAuthFromStorage = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear auth from storage:', e);
  }
};

const getInitialAuth = () => {
  const stored = getStoredAuth();
  return {
    userId: stored?.userId || null,
    username: stored?.username || null,
    isAuthenticated: !!stored,
  };
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  ...getInitialAuth(),

  signUp: (username: string, password: string) => {
    if (!username || !password) {
      return { success: false, error: 'Username and password are required' };
    }

    if (username.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters' };
    }

    if (password.length < 4) {
      return { success: false, error: 'Password must be at least 4 characters' };
    }

    // Check if username already exists
    const existing = getStoredAuth();
    if (existing && existing.username === username) {
      return { success: false, error: 'Username already exists' };
    }

    const userId = uuidv4();
    const passwordHash = hashPassword(password);
    const auth: AuthUser = { userId, username, passwordHash };

    saveAuthToStorage(auth);
    set({ userId, username, isAuthenticated: true });

    return { success: true };
  },

  signIn: (username: string, password: string) => {
    if (!username || !password) {
      return { success: false, error: 'Username and password are required' };
    }

    const stored = getStoredAuth();

    if (!stored) {
      return { success: false, error: 'No account found with this username' };
    }

    if (stored.username !== username) {
      return { success: false, error: 'Invalid username or password' };
    }

    const passwordHash = hashPassword(password);
    if (stored.passwordHash !== passwordHash) {
      return { success: false, error: 'Invalid username or password' };
    }

    set({ userId: stored.userId, username: stored.username, isAuthenticated: true });

    return { success: true };
  },

  signOut: () => {
    clearAuthFromStorage();
    set({ userId: null, username: null, isAuthenticated: false });
  },

  getCurrentUser: () => {
    const { userId, username } = get();
    if (!userId || !username) {
      return null;
    }
    return { userId, username };
  },
}));
