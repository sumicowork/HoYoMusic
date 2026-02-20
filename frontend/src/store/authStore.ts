import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
  initializeAuth: () => Promise<void>;
  setIsInitialized: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false,
  isInitialized: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
    set({ token, isAuthenticated: !!token });
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false });
  },
  initializeAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isAuthenticated: false, isInitialized: true });
      return;
    }

    try {
      // Import authService here to avoid circular dependencies
      const { authService } = await import('../services/authService');
      const user = await authService.getCurrentUser();
      set({
        user,
        token,
        isAuthenticated: true,
        isInitialized: true
      });
    } catch (error) {
      console.error('Failed to verify token:', error);
      localStorage.removeItem('token');
      set({ user: null, token: null, isAuthenticated: false, isInitialized: true });
    }
  },
  setIsInitialized: (value) => set({ isInitialized: value })
}));

