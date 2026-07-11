import { create } from 'zustand';
import type { Track } from '@/generated/api-types';

export type RepeatMode = 'off' | 'all' | 'one';

interface PlayerState {
  // ---- state ----
  queue: Track[];
  currentIndex: number;
  isPlaying: boolean;
  progressSec: number;
  volume: number; // 0..1
  repeat: RepeatMode;
  shuffle: boolean;

  // ---- getters ----
  current: () => Track | undefined;

  // ---- actions ----
  setQueue: (tracks: Track[], startIdx?: number) => void;
  playIndex: (i: number) => void;
  togglePlay: () => void;
  playNext: () => void;
  playPrev: () => void;
  seek: (sec: number) => void;
  setVolume: (v: number) => void;
  setProgress: (sec: number) => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  setCurrent: (track: Track) => void;
}

const clampVolume = (v: number) => Math.min(1, Math.max(0, v));
const clampIndex = (i: number, len: number) =>
  len === 0 ? -1 : ((i % len) + len) % len;

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  currentIndex: -1,
  isPlaying: false,
  progressSec: 0,
  volume: 1,
  repeat: 'off',
  shuffle: false,

  current: () => {
    const { queue, currentIndex } = get();
    return currentIndex >= 0 && currentIndex < queue.length
      ? queue[currentIndex]
      : undefined;
  },

  setQueue: (tracks, startIdx = 0) => {
    const idx = clampIndex(startIdx, tracks.length);
    set({
      queue: tracks,
      currentIndex: idx,
      isPlaying: tracks.length > 0,
      progressSec: 0,
    });
  },

  playIndex: (i) => {
    const { queue } = get();
    const idx = clampIndex(i, queue.length);
    if (idx < 0) return;
    set({ currentIndex: idx, isPlaying: true, progressSec: 0 });
  },

  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

  playNext: () => {
    const { queue, currentIndex, shuffle, repeat } = get();
    if (queue.length === 0) return;
    // repeat "one" replays the current track instead of advancing.
    if (repeat === 'one') {
      set({ currentIndex: currentIndex < 0 ? 0 : currentIndex, isPlaying: true, progressSec: 0 });
      return;
    }
    if (shuffle) {
      if (queue.length === 1) {
        set({ progressSec: 0 });
        return;
      }
      let next = currentIndex;
      while (next === currentIndex) {
        next = Math.floor(Math.random() * queue.length);
      }
      set({ currentIndex: next, isPlaying: true, progressSec: 0 });
      return;
    }
    let next = currentIndex + 1;
    if (next >= queue.length) {
      if (repeat === 'all') next = 0;
      else {
        set({ isPlaying: false, progressSec: 0 });
        return;
      }
    }
    set({ currentIndex: next, isPlaying: true, progressSec: 0 });
  },

  playPrev: () => {
    const { queue, currentIndex, progressSec, shuffle, repeat } = get();
    if (queue.length === 0) return;
    // repeat "one" replays the current track instead of going back.
    if (repeat === 'one') {
      set({ currentIndex: currentIndex < 0 ? 0 : currentIndex, isPlaying: true, progressSec: 0 });
      return;
    }
    // If more than 3s in, restart current track instead of going back.
    if (progressSec > 3) {
      set({ progressSec: 0 });
      return;
    }
    if (shuffle) {
      if (queue.length === 1) {
        set({ progressSec: 0 });
        return;
      }
      let prev = currentIndex;
      while (prev === currentIndex) {
        prev = Math.floor(Math.random() * queue.length);
      }
      set({ currentIndex: prev, isPlaying: true, progressSec: 0 });
      return;
    }
    let prev = currentIndex - 1;
    if (prev < 0) {
      if (repeat === 'all') prev = queue.length - 1;
      else {
        set({ progressSec: 0 });
        return;
      }
    }
    set({ currentIndex: prev, isPlaying: true, progressSec: 0 });
  },

  seek: (sec) => set({ progressSec: Math.max(0, sec) }),

  setVolume: (v) => set({ volume: clampVolume(v) }),

  setProgress: (sec) => set({ progressSec: Math.max(0, sec) }),

  cycleRepeat: () =>
    set((s) => ({
      repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off',
    })),

  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),

  setCurrent: (track) => {
    const { queue } = get();
    const idx = queue.findIndex((t) => t.id === track.id);
    if (idx >= 0) {
      set({ currentIndex: idx, isPlaying: true, progressSec: 0 });
    } else {
      set({
        queue: [...queue, track],
        currentIndex: queue.length,
        isPlaying: true,
        progressSec: 0,
      });
    }
  },
}));
