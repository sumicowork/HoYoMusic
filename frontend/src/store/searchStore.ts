import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SearchState {
  history: string[];
  addSearch: (keyword: string) => void;
  removeSearch: (keyword: string) => void;
  clearHistory: () => void;
}

const MAX_HISTORY = 20;

export const useSearchStore = create<SearchState>()(
  persist(
    (set, get) => ({
      history: [],

      addSearch: (keyword: string) => {
        const trimmed = keyword.trim();
        if (!trimmed) return;
        const current = get().history.filter(k => k !== trimmed);
        set({ history: [trimmed, ...current].slice(0, MAX_HISTORY) });
      },

      removeSearch: (keyword: string) => {
        set({ history: get().history.filter(k => k !== keyword) });
      },

      clearHistory: () => {
        set({ history: [] });
      },
    }),
    {
      name: 'hoyomusic-search-history',
    }
  )
);

