/**
 * In-memory TTL + LRU cache for expensive/rarely-changing queries
 * (games list, tag groups, album lists, etc.)
 *
 * Features:
 * - TTL-based expiration
 * - Max-entries LRU eviction (prevents unbounded memory growth)
 * - Stale-while-revalidate pattern via getOrRefresh()
 * - Hit/miss statistics
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<any>>();
  private maxEntries: number;
  private hits = 0;
  private misses = 0;

  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
  }

  set<T>(key: string, data: T, ttlSeconds = 60): void {
    // LRU eviction: if at max capacity, delete oldest entry (first key in Map)
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    // Delete + re-set to move key to end (most recently used)
    this.store.delete(key);
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) { this.misses++; return null; }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    // Move to end (most recently used)
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.data as T;
  }

  /**
   * Stale-while-revalidate: returns cached value (even if stale) immediately,
   * and triggers a background refresh. If no cached value exists, awaits fetchFn.
   */
  async getOrRefresh<T>(key: string, fetchFn: () => Promise<T>, ttlSeconds = 60): Promise<T> {
    const entry = this.store.get(key);
    if (entry) {
      const isExpired = Date.now() > entry.expiresAt;
      if (isExpired) {
        // Return stale data now, refresh in background
        fetchFn()
          .then((data) => this.set(key, data, ttlSeconds))
          .catch(() => {});
      }
      this.hits++;
      return entry.data as T;
    }
    // No cached value — must await
    this.misses++;
    const data = await fetchFn();
    this.set(key, data, ttlSeconds);
    return data;
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidatePattern(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }

  /** Get cache performance statistics */
  stats() {
    const total = this.hits + this.misses;
    return {
      entries: this.store.size,
      maxEntries: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(1) + '%' : 'N/A',
    };
  }
}

export const cache = new MemoryCache(500);
