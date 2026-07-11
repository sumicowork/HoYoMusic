import { useEffect } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { tauri } from '@/lib/tauri';

interface TauriLike {
  registerShortcut?: (
    accel: string,
    handler: () => void,
  ) => (() => void) | void;
}

function asTauri(t: unknown): TauriLike {
  return (t ?? {}) as TauriLike;
}

/**
 * Registers global/hardware-media shortcuts and routes them to the store.
 * No-op in the browser where `tauri.registerShortcut` is unavailable.
 */
export function useGlobalShortcuts(): void {
  useEffect(() => {
    const t = asTauri(tauri);
    if (!t.registerShortcut) return;

    const bindings: Array<[string, () => void]> = [
      ['Space', () => usePlayerStore.getState().togglePlay()],
      ['MediaNextTrack', () => usePlayerStore.getState().playNext()],
      ['MediaPreviousTrack', () => usePlayerStore.getState().playPrev()],
      ['MediaPlayPause', () => usePlayerStore.getState().togglePlay()],
    ];

    const unsubscribers: Array<() => void> = [];
    for (const [accel, handler] of bindings) {
      const unsub = t.registerShortcut(accel, handler);
      if (typeof unsub === 'function') unsubscribers.push(unsub);
    }

    return () => {
      for (const unsub of unsubscribers) unsub();
    };
  }, []);
}
