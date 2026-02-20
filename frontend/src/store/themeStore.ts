import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ThemeMode } from '../theme/themeConfig';

interface ThemeState {
  mode: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'dark', // 默认深色主题

      setTheme: (mode) => {
        set({ mode });
        // 更新document的data-theme属性
        document.documentElement.setAttribute('data-theme', mode);
      },

      toggleTheme: () => {
        const state = get();
        const newMode = state.mode === 'light' ? 'dark' : 'light';
        state.setTheme(newMode);
      },
    }),
    {
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        // 恢复主题时应用到document
        if (state) {
          document.documentElement.setAttribute('data-theme', state.mode);
        }
      },
    }
  )
);

