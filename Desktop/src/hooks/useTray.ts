import { useCallback, useEffect } from 'react';
import { tauri } from '@/lib/tauri';

interface TauriLike {
  showTray?: () => void;
  hideToTray?: () => void;
  /** Optional restore-window helper; falls back to re-showing the tray. */
  showWindow?: () => void;
}

function asTauri(t: unknown): TauriLike {
  return (t ?? {}) as TauriLike;
}

/**
 * Manages the system tray lifecycle and exposes helpers to minimize the app
 * to the tray or restore the window. Safe in the browser (no-ops).
 */
export function useTray(): {
  hideToTray: () => void;
  showWindow: () => void;
} {
  useEffect(() => {
    const t = asTauri(tauri);
    if (t.showTray) t.showTray();
  }, []);

  const hideToTray = useCallback(() => {
    const t = asTauri(tauri);
    if (t.hideToTray) t.hideToTray();
  }, []);

  const showWindow = useCallback(() => {
    const t = asTauri(tauri);
    if (t.showWindow) {
      t.showWindow();
    } else if (t.showTray) {
      // No explicit restore API: ensure the tray (and thus the window toggle) exists.
      t.showTray();
    }
  }, []);

  return { hideToTray, showWindow };
}
