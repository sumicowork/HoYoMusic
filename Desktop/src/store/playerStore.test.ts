import { beforeEach, describe, expect, it } from 'vitest';
import { usePlayerStore } from './playerStore';
import type { Track } from '@/generated/api-types';

function makeTrack(id: string, audioUrl = `https://example.com/${id}.mp3`): Track {
  return {
    id,
    title: `Track ${id}`,
    artistName: 'Artist',
    durationSec: 100,
    audioUrl,
  };
}

const t1 = makeTrack('1');
const t2 = makeTrack('2');
const t3 = makeTrack('3');

function resetStore() {
  usePlayerStore.setState({
    queue: [],
    currentIndex: -1,
    isPlaying: false,
    progressSec: 0,
    volume: 1,
    repeat: 'off',
    shuffle: false,
  });
}

const get = () => usePlayerStore.getState();

beforeEach(() => {
  resetStore();
});

describe('playerStore — basic toggles', () => {
  it('togglePlay flips isPlaying', () => {
    expect(get().isPlaying).toBe(false);
    get().togglePlay();
    expect(get().isPlaying).toBe(true);
    get().togglePlay();
    expect(get().isPlaying).toBe(false);
  });

  it('cycleRepeat rotates off -> all -> one -> off', () => {
    expect(get().repeat).toBe('off');
    get().cycleRepeat();
    expect(get().repeat).toBe('all');
    get().cycleRepeat();
    expect(get().repeat).toBe('one');
    get().cycleRepeat();
    expect(get().repeat).toBe('off');
  });

  it('toggleShuffle flips shuffle', () => {
    expect(get().shuffle).toBe(false);
    get().toggleShuffle();
    expect(get().shuffle).toBe(true);
  });
});

describe('playerStore — queue & current track', () => {
  it('setQueue loads the queue, starts at startIdx and plays when non-empty', () => {
    get().setQueue([t1, t2, t3], 1);
    expect(get().queue).toHaveLength(3);
    expect(get().currentIndex).toBe(1);
    expect(get().current()).toBe(t2);
    expect(get().isPlaying).toBe(true);
    expect(get().progressSec).toBe(0);
  });

  it('setQueue with empty array leaves currentIndex at -1 and does not play', () => {
    get().setQueue([]);
    expect(get().currentIndex).toBe(-1);
    expect(get().current()).toBeUndefined();
    expect(get().isPlaying).toBe(false);
  });

  it('playIndex sets the index and plays', () => {
    get().setQueue([t1, t2, t3]);
    get().playIndex(2);
    expect(get().currentIndex).toBe(2);
    expect(get().isPlaying).toBe(true);
  });

  it('setCurrent uses an existing track, and appends a new one', () => {
    get().setQueue([t1]);
    get().setCurrent(t1);
    expect(get().currentIndex).toBe(0);

    get().setCurrent(t2);
    expect(get().queue).toHaveLength(2);
    expect(get().currentIndex).toBe(1);
    expect(get().isPlaying).toBe(true);
  });
});

describe('playerStore — playNext', () => {
  it('advances to the next track (repeat off)', () => {
    get().setQueue([t1, t2, t3]);
    get().playNext();
    expect(get().currentIndex).toBe(1);
    expect(get().current()).toBe(t2);
  });

  it('stops at the end when repeat is off', () => {
    get().setQueue([t1, t2], 1); // at last track
    get().playNext();
    expect(get().currentIndex).toBe(1);
    expect(get().isPlaying).toBe(false);
  });

  it('wraps to the first track when repeat is all', () => {
    get().setQueue([t1, t2, t3], 2);
    get().cycleRepeat(); // off -> all
    get().playNext();
    expect(get().currentIndex).toBe(0);
    expect(get().isPlaying).toBe(true);
  });

  it('repeats the same track when repeat is one', () => {
    get().setQueue([t1, t2], 0);
    get().cycleRepeat(); // off -> all
    get().cycleRepeat(); // all -> one
    expect(get().repeat).toBe('one');
    get().playNext();
    expect(get().currentIndex).toBe(0);
    expect(get().isPlaying).toBe(true);
  });
});

describe('playerStore — playPrev', () => {
  it('goes to the previous track (repeat off)', () => {
    get().setQueue([t1, t2, t3], 2);
    get().playPrev();
    expect(get().currentIndex).toBe(1);
  });

  it('restarts the current track when more than 3s in', () => {
    get().setQueue([t1, t2, t3], 1);
    get().seek(10); // progressSec = 10
    get().playPrev();
    expect(get().currentIndex).toBe(1); // unchanged
    expect(get().progressSec).toBe(0); // restarted
  });

  it('wraps to the last track when at the start and repeat is all', () => {
    get().setQueue([t1, t2, t3], 0);
    get().cycleRepeat(); // off -> all
    get().playPrev();
    expect(get().currentIndex).toBe(2);
  });

  it('stays put when at the start and repeat is off', () => {
    get().setQueue([t1, t2], 0);
    get().playPrev();
    expect(get().currentIndex).toBe(0);
    expect(get().progressSec).toBe(0);
  });
});

describe('playerStore — progress / volume clamping', () => {
  it('setProgress clamps negatives to 0', () => {
    get().setProgress(-5);
    expect(get().progressSec).toBe(0);
    get().setProgress(42);
    expect(get().progressSec).toBe(42);
  });

  it('seek clamps negatives to 0', () => {
    get().seek(-1);
    expect(get().progressSec).toBe(0);
  });

  it('setVolume clamps to [0, 1]', () => {
    get().setVolume(2);
    expect(get().volume).toBe(1);
    get().setVolume(-3);
    expect(get().volume).toBe(0);
    get().setVolume(0.5);
    expect(get().volume).toBe(0.5);
  });
});
