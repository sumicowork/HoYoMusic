import { useEffect, useRef, type MutableRefObject } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import type { Track } from '@/generated/api-types';

/**
 * Owns the single HTMLAudioElement that drives playback for the whole app.
 * The store is the source of truth for intent (what track, playing or not,
 * volume, seek target); this hook is the bridge between the store and the
 * underlying <audio> element, and is the single producer of `progressSec`
 * via the `timeupdate` event.
 */
export function useAudioPlayer(): { audioRef: MutableRefObject<HTMLAudioElement | null> } {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const track = usePlayerStore((s) => s.current()) as Track | undefined;
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const progressSec = usePlayerStore((s) => s.progressSec);

  // Create the shared audio element once.
  useEffect(() => {
    if (!audioRef.current && typeof Audio !== 'undefined') {
      audioRef.current = new Audio();
    }
  }, []);

  // Wire element events -> store.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      usePlayerStore.getState().setProgress(audio.currentTime);
    };
    const handleEnded = () => {
      const state = usePlayerStore.getState();
      if (state.repeat === 'one') {
        audio.currentTime = 0;
        void audio.play().catch(() => undefined);
      } else {
        state.playNext();
      }
    };
    const handleLoadedMetadata = () => {
      /* nothing special; progress/volume already applied by other effects */
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);

  // Track change + play/pause toggle in a single effect so we never call
  // play() twice for the same logical action (e.g. on mount both `track`
  // and `isPlaying` transition at once).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (audio.src !== track.audioUrl) {
      audio.src = track.audioUrl;
    }
    if (isPlaying) {
      void audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  }, [track, isPlaying]);

  // Volume.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  // Seek sync: store.seek() already updated progressSec; when the element's
  // clock drifts from the requested position by >1s, snap it into place.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (Math.abs(audio.currentTime - progressSec) > 1) {
      audio.currentTime = progressSec;
    }
  }, [progressSec]);

  return { audioRef };
}
