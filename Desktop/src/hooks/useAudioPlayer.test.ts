import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePlayerStore } from '@/store/playerStore';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import type { Track } from '@/generated/api-types';

// ---- Mock the global Audio element (jsdom has no real <audio>) ----
class MockAudio {
  src = '';
  volume = 1;
  currentTime = 0;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
}

const audioInstances: MockAudio[] = [];

beforeEach(() => {
  audioInstances.length = 0;
  (globalThis as unknown as { Audio: unknown }).Audio = class extends MockAudio {
    constructor() {
      super();
      audioInstances.push(this);
    }
  };

  // reset player store to a clean, controlled state
  usePlayerStore.setState({
    queue: [],
    currentIndex: -1,
    isPlaying: false,
    progressSec: 0,
    volume: 1,
    repeat: 'off',
    shuffle: false,
  });
});

function track(id: string): Track {
  return {
    id,
    title: id,
    artistName: 'A',
    durationSec: 10,
    audioUrl: `https://cdn.test/${id}.mp3`,
  };
}

describe('useAudioPlayer', () => {
  it('sets audio.src and calls play() when a track is playing on mount', () => {
    const t = track('a');
    usePlayerStore.setState({ queue: [t], currentIndex: 0, isPlaying: true });

    renderHook(() => useAudioPlayer());

    expect(audioInstances).toHaveLength(1);
    const audio = audioInstances[0];
    expect(audio.src).toBe(t.audioUrl);
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it('does not call play() when paused; pauses the element instead', () => {
    const t = track('a');
    usePlayerStore.setState({ queue: [t], currentIndex: 0, isPlaying: false });

    renderHook(() => useAudioPlayer());

    const audio = audioInstances[0];
    expect(audio.src).toBe(t.audioUrl);
    expect(audio.play).not.toHaveBeenCalled();
    expect(audio.pause).toHaveBeenCalledTimes(1);
  });

  it('calls play() when isPlaying flips from false to true', () => {
    const t = track('a');
    usePlayerStore.setState({ queue: [t], currentIndex: 0, isPlaying: false });

    const { result } = renderHook(() => useAudioPlayer());
    const audio = audioInstances[0];
    expect(audio.play).not.toHaveBeenCalled();

    act(() => {
      usePlayerStore.getState().togglePlay();
    });

    expect(usePlayerStore.getState().isPlaying).toBe(true);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(result.current.audioRef.current).toBe(audio);
  });

  it('swaps audio.src and plays when the current track changes', () => {
    const a = track('a');
    const b = track('b');
    usePlayerStore.setState({ queue: [a, b], currentIndex: 0, isPlaying: true });

    renderHook(() => useAudioPlayer());

    const audio = audioInstances[0];
    expect(audio.src).toBe(a.audioUrl);

    act(() => {
      usePlayerStore.getState().setQueue([a, b], 1); // switch to b
    });

    expect(audio.src).toBe(b.audioUrl);
    // one play on mount + one on track switch
    expect(audio.play).toHaveBeenCalledTimes(2);
  });
});
