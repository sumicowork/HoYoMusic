// HoYoMusic desktop — Tauri v2 bridge.
//
// Single import surface for the React SPA. Defensive: all methods become
// safe no-ops when running in a plain browser (window.__TAURI__ undefined),
// so the SPA can be developed with `npm run dev` against Vite only.

import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

const isTauri = (): boolean =>
  typeof window !== 'undefined' &&
  (window as unknown as { __TAURI__?: unknown }).__TAURI__ !== undefined;

export type MediaAction = 'play' | 'pause' | 'next' | 'prev' | 'seek';

export interface MediaTrack {
  title: string;
  artist: string;
  album?: string;
  coverPath?: string;
}

export interface DownloadTrack {
  id: string;
  title: string;
  audioUrl: string;
}

// Map of registered global shortcuts -> their callbacks.
const shortcutHandlers = new Map<string, () => void>();
let shortcutListener: Promise<UnlistenFn> | null = null;

async function ensureShortcutListener(): Promise<void> {
  if (shortcutListener) {
    await shortcutListener;
    return;
  }
  shortcutListener = listen<string>('global-shortcut', (event) => {
    const cb = shortcutHandlers.get(event.payload);
    if (cb) cb();
  });
  await shortcutListener;
}

export const tauri = {
  /** Push now-playing metadata to the OS media session. */
  async setMediaMetadata(track: MediaTrack): Promise<void> {
    if (!isTauri()) return;
    await tauriInvoke('set_media_metadata', {
      title: track.title,
      artist: track.artist,
      album: track.album ?? null,
      coverPath: track.coverPath ?? null,
    });
  },

  /** Reflect play/pause state to the OS media session. */
  async setPlaybackState(isPlaying: boolean): Promise<void> {
    if (!isTauri()) return;
    await tauriInvoke('set_playback_state', { isPlaying });
  },

  /**
   * Subscribe to media actions (SMTC / media keys). Best-effort: the Rust
   * side currently exposes the event channel; a future Windows SMTC
   * integration emits `media-action` events that arrive here.
   */
  onMediaAction(cb: (action: MediaAction) => void): void {
    if (!isTauri()) return;
    void tauriInvoke('register_media_action');
    void listen<MediaAction>('media-action', (event) => cb(event.payload));
  },

  /** Restore the window from the system tray. */
  async showTray(): Promise<void> {
    if (!isTauri()) return;
    await getCurrentWindow().show();
    await getCurrentWindow().setFocus();
  },

  /** Minimize the window to the system tray. */
  async hideToTray(): Promise<void> {
    if (!isTauri()) return;
    await getCurrentWindow().hide();
  },

  /** Register a global hotkey (e.g. 'Space', 'CmdOrCtrl+Right'). */
  async registerShortcut(accelerator: string, cb: () => void): Promise<void> {
    if (!isTauri()) return;
    await tauriInvoke('register_shortcut', { accelerator });
    shortcutHandlers.set(accelerator, cb);
    await ensureShortcutListener();
  },

  /** Enqueue a best-effort download of a track. */
  async startDownload(track: DownloadTrack): Promise<void> {
    if (!isTauri()) return;
    await tauriInvoke('start_download', {
      id: track.id,
      title: track.title,
      audioUrl: track.audioUrl,
    });
  },

  /** Raw passthrough to the Tauri invoke API. */
  invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    return tauriInvoke<T>(cmd, args);
  },
};

export default tauri;
