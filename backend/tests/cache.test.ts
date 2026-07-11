import { describe, it, expect, beforeEach } from 'vitest';
import { cache } from '../src/utils/cache';

describe('MemoryCache (cache singleton)', () => {
  beforeEach(() => {
    cache.clear();
  });

  it('set then get returns the stored value', () => {
    cache.set('k1', { hello: 'world' }, 60);
    expect(cache.get('k1')).toEqual({ hello: 'world' });
  });

  it('get of a missing key returns null and counts a miss', () => {
    const before = cache.stats().misses;
    expect(cache.get('nope')).toBeNull();
    expect(cache.stats().misses).toBe(before + 1);
  });

  it('entry expires after its ttl elapses', () => {
    cache.set('exp', 'value', -1); // already expired
    expect(cache.get('exp')).toBeNull();
  });

  it('invalidate removes a single key', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.invalidate('a');
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe(2);
  });

  it('invalidatePattern removes only matching prefixes', () => {
    cache.set('games:all', [1]);
    cache.set('games:1', { id: 1 });
    cache.set('albums:1', { id: 1 });
    cache.invalidatePattern('games:');
    expect(cache.get('games:all')).toBeNull();
    expect(cache.get('games:1')).toBeNull();
    expect(cache.get('albums:1')).toEqual({ id: 1 });
  });

  it('getOrRefresh awaits fetchFn when no cache exists', async () => {
    const fetch = async () => ({ loaded: true });
    const result = await cache.getOrRefresh('lazy', fetch, 60);
    expect(result).toEqual({ loaded: true });
    // second call hits cache (no fetch invocation needed)
    const result2 = await cache.getOrRefresh('lazy', fetch, 60);
    expect(result2).toEqual({ loaded: true });
  });

  it('getOrRefresh returns stale data immediately and refreshes in background', async () => {
    cache.set('stale', 'old', -1); // expired
    let resolved: string | undefined;
    const fetch = async () => {
      resolved = 'new';
      return 'new';
    };
    const immediate = await cache.getOrRefresh('stale', fetch, 60);
    // returns stale value synchronously on first tick
    expect(immediate).toBe('old');
    // background refresh eventually updates the cache
    await new Promise((r) => setTimeout(r, 10));
    expect(cache.get('stale')).toBe('new');
  });

  it('stats report a computed hit rate', () => {
    const before = cache.stats();
    cache.set('x', 1);
    cache.get('x'); // hit
    cache.get('missing'); // miss
    const s = cache.stats();
    const total = before.hits + before.misses + 2;
    const expectedRate = ((before.hits + 1) / total * 100).toFixed(1) + '%';
    expect(s.hits).toBe(before.hits + 1);
    expect(s.misses).toBe(before.misses + 1);
    expect(s.hitRate).toBe(expectedRate);
  });
});
