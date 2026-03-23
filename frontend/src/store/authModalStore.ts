import { create } from 'zustand';

export type AuthModalMode = 'login' | 'register';

interface AuthModalState {
  open: boolean;
  mode: AuthModalMode;
  redirectTo: string | null;
  openLogin: (redirectTo?: string | null) => void;
  openRegister: (redirectTo?: string | null) => void;
  close: () => void;
  setMode: (mode: AuthModalMode) => void;
}

export const useAuthModalStore = create<AuthModalState>((set) => ({
  open: false,
  mode: 'login',
  redirectTo: null,
  openLogin: (redirectTo) => set({ open: true, mode: 'login', redirectTo: redirectTo ?? null }),
  openRegister: (redirectTo) => set({ open: true, mode: 'register', redirectTo: redirectTo ?? null }),
  close: () => set({ open: false, redirectTo: null }),
  setMode: (mode) => set({ mode }),
}));

