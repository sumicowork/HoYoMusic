import { useEffect } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { tauri } from '@/lib/tauri';
import type { Track } from '@/generated/api-types';

/** Loosely-typed view of the tauri bridge so these hooks stay defensive
 *  (no crash / no type error) when running in a plain browser. */
interface TauriLike {
  setMediaMetadata?: (meta: MediaMetadataLike) => void;
  setPlaybackState?: (playing: boolean) => void;
  onMediaAction?: (cb: (action: MediaActionLike) => void) => (() => void) | void;
}

interface MediaMetadataLike {
  title?: string;
  artist?: string;
  album?: string;
  coverPath?: string;
}

type MediaActionLike = 'play' | 'pause' | 'next' | 'prev' | 'seek' | { action: 'seek'; seekTime: number };

function asTauri(t: unknown): TauriLike {
  return (t ?? {}) as TauriLike;
}

/**
 * Bridges the player store to the OS media session (lock screen / headset
 * controls). Updates metadata + playback state on change, and routes native
 * media actions back into the store.
 */
export function useMediaSession(): void {
  const track = usePlayerStore((s) => s.current()) as Track | undefined;
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const t = asTauri(tauri);

  // Metadata follows the current track. Deps are value-based (not `t`, which is
  // a fresh wrapper every render) so this runs only when the track changes.
  useEffect(() => {
    if (!t.setMediaMetadata || !track) return;
    t.setMediaMetadata({
      title: track.title,
      artist: track.artistName,
      album: track.albumTitle,
      coverPath: track.coverUrl,
    });
  }, [track, t.setMediaMetadata]);

  // Playback state follows isPlaying.
  useEffect(() => {
    if (!t.setPlaybackState) return;
    t.setPlaybackState(isPlaying);
  }, [isPlaying, t.setPlaybackState]);

  // Native media action -> store. Registered exactly once (stable module
  // object), so repeated renders don't stack listeners.
  useEffect(() => {
    if (!t.onMediaAction) return;
    const unsubscribe = t.onMediaAction((action) => {
      const store = usePlayerStore.getState();
      const kind = typeof action === 'string' ? action : action.action;
      switch (kind) {
        case 'play':
          if (!store.isPlaying) store.togglePlay();
          break;
        case 'pause':
          if (store.isPlaying) store.togglePlay();
          break;
        case 'next':
          store.playNext();
          break;
        case 'prev':
          store.playPrev();
          break;
        case 'seek': {
          const seekTime = typeof action === 'object' ? action.seekTime : undefined;
          if (typeof seekTime === 'number') store.seek(seekTime);
          break;
        }
        default:
          break;
      }
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [t.onMediaAction]);
}
