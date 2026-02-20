import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Track } from '../types';
import { Howl } from 'howler';

export type PlayMode = 'sequence' | 'loop' | 'shuffle' | 'single';

interface PlayerState {
  currentTrack: Track | null;
  playlist: Track[];
  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  howl: Howl | null;
  playMode: PlayMode;

  setCurrentTrack: (track: Track | null) => void;
  setPlaylist: (tracks: Track[]) => void;
  setIsPlaying: (playing: boolean) => void;
  play: (track?: Track) => void;
  pause: () => void;
  togglePlay: () => void;
  setVolume: (volume: number) => void;
  seek: (position: number) => void;
  next: () => void;
  previous: () => void;
  updateProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  setPlayMode: (mode: PlayMode) => void;
  togglePlayMode: () => void;
  removeFromPlaylist: (trackId: number) => void;
  clearPlaylist: () => void;
  addToPlaylist: (track: Track) => void;
  playTrackOnly: (track: Track) => void;
  reorderPlaylist: (newPlaylist: Track[]) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
  currentTrack: null,
  playlist: [],
  isPlaying: false,
  volume: 0.8,
  progress: 0,
  duration: 0,
  howl: null,
  playMode: 'sequence',

  setCurrentTrack: (track) => set({ currentTrack: track }),

  setPlaylist: (tracks) => set({ playlist: tracks }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  play: (track) => {
    const state = get();

    if (track) {
      // Stop current howl
      if (state.howl) {
        state.howl.unload();
      }

      set({ currentTrack: track, isPlaying: true });
    } else if (state.howl) {
      state.howl.play();
      set({ isPlaying: true });
    }
  },

  playTrackOnly: (track) => {
    const state = get();
    // Check if track is already in playlist
    const exists = state.playlist.some((t) => t.id === track.id);
    if (!exists) {
      // Add to end of playlist
      set({ playlist: [...state.playlist, track] });
    }
    // Play the track
    if (state.howl) {
      state.howl.unload();
    }
    set({ currentTrack: track, isPlaying: true });
  },

  pause: () => {
    const state = get();
    if (state.howl) {
      state.howl.pause();
    }
    set({ isPlaying: false });
  },

  togglePlay: () => {
    const state = get();
    if (state.isPlaying) {
      state.pause();
    } else {
      state.play();
    }
  },

  setVolume: (volume) => {
    const state = get();
    if (state.howl) {
      state.howl.volume(volume);
    }
    set({ volume });
  },

  seek: (position) => {
    const state = get();
    if (state.howl) {
      state.howl.seek(position);
    }
    set({ progress: position });
  },

  next: () => {
    const state = get();
    const currentIndex = state.playlist.findIndex((t) => t.id === state.currentTrack?.id);

    if (state.playMode === 'shuffle') {
      // 随机播放：随机选择下一首（排除当前歌曲）
      if (state.playlist.length > 1) {
        let randomIndex;
        do {
          randomIndex = Math.floor(Math.random() * state.playlist.length);
        } while (randomIndex === currentIndex);
        state.play(state.playlist[randomIndex]);
      }
    } else if (state.playMode === 'loop') {
      // 列表循环：播放下一首，到末尾时循环到第一首
      const nextIndex = (currentIndex + 1) % state.playlist.length;
      state.play(state.playlist[nextIndex]);
    } else {
      // 顺序播放：播放下一首，到末尾时停止
      if (currentIndex < state.playlist.length - 1) {
        state.play(state.playlist[currentIndex + 1]);
      }
    }
  },

  previous: () => {
    const state = get();
    const currentIndex = state.playlist.findIndex((t) => t.id === state.currentTrack?.id);

    if (state.playMode === 'shuffle') {
      // 随机播放：随机选择上一首
      if (state.playlist.length > 1) {
        let randomIndex;
        do {
          randomIndex = Math.floor(Math.random() * state.playlist.length);
        } while (randomIndex === currentIndex);
        state.play(state.playlist[randomIndex]);
      }
    } else if (state.playMode === 'loop') {
      // 列表循环：播放上一首，到开头时循环到最后一首
      const prevIndex = currentIndex <= 0 ? state.playlist.length - 1 : currentIndex - 1;
      state.play(state.playlist[prevIndex]);
    } else {
      // 顺序播放：播放上一首，到开头时停止
      if (currentIndex > 0) {
        state.play(state.playlist[currentIndex - 1]);
      }
    }
  },

  updateProgress: (progress) => set({ progress }),

  setDuration: (duration) => set({ duration }),

  setPlayMode: (mode) => set({ playMode: mode }),

  togglePlayMode: () => {
    const state = get();
    const modes: PlayMode[] = ['sequence', 'loop', 'shuffle', 'single'];
    const currentIndex = modes.indexOf(state.playMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    set({ playMode: nextMode });
  },

  removeFromPlaylist: (trackId) => {
    const state = get();
    const newPlaylist = state.playlist.filter((t) => t.id !== trackId);

    // 如果删除的是当前播放的歌曲，则停止播放
    if (state.currentTrack?.id === trackId) {
      if (state.howl) {
        state.howl.unload();
      }
      // 如果队列中还有其他歌曲，播放下一首
      if (newPlaylist.length > 0) {
        const currentIndex = state.playlist.findIndex((t) => t.id === trackId);
        const nextIndex = currentIndex < newPlaylist.length ? currentIndex : 0;
        set({ playlist: newPlaylist });
        state.play(newPlaylist[nextIndex]);
      } else {
        // 队列为空
        set({
          playlist: [],
          currentTrack: null,
          isPlaying: false,
          progress: 0,
          duration: 0
        });
      }
    } else {
      set({ playlist: newPlaylist });
    }
  },

  clearPlaylist: () => {
    const state = get();
    if (state.howl) {
      state.howl.unload();
    }
    set({
      playlist: [],
      currentTrack: null,
      isPlaying: false,
      progress: 0,
      duration: 0,
      howl: null
    });
  },

  addToPlaylist: (track) => {
    const state = get();
    // 检查歌曲是否已在队列中
    const exists = state.playlist.some((t) => t.id === track.id);
    if (!exists) {
      set({ playlist: [...state.playlist, track] });
    }
  },

  reorderPlaylist: (newPlaylist) => {
    set({ playlist: newPlaylist });
  },
}),
    {
      name: 'hoyomusic-player-storage', // localStorage 的 key
      // 只持久化部分状态
      partialize: (state) => ({
        playlist: state.playlist,
        currentTrack: state.currentTrack,
        playMode: state.playMode,
        volume: state.volume,
      }),
    }
  )
);

