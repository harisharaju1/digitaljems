/**
 * In-memory cache module — Step 2 (SWR Caching)
 * Implements stale-while-revalidate: serve cached data immediately,
 * revalidate in the background when TTL has expired.
 */

interface CacheEntry {
  data: unknown;
  cachedAt: number; // Date.now() timestamp in milliseconds
}

// CONCEPT: module singleton — one Map shared across the entire app.
// All files that import `cache` reference this exact same object in memory.
const store = new Map<string, CacheEntry>();

export const cache = {
  // CONCEPT: generic function — <T> lets the caller declare the expected return type.
  // cache.get<Product[]>("products:page1") → returns Product[] | null
  // cache.get<Product>("product:abc123")   → returns Product | null
  get<T>(key: string): T | null {
    const entry = store.get(key);
    // CONCEPT: nullish guard — handle the missing case before the happy path
    if (!entry) return null;
    return entry.data as T; // CONCEPT: type assertion — we trust what was set
  },

  set(key: string, data: unknown): void {
    // CONCEPT: Date.now() — record the exact millisecond this entry was cached
    store.set(key, { data, cachedAt: Date.now() });
  },

  // Returns true if the entry is missing or older than ttlMs milliseconds.
  isStale(key: string, ttlMs: number): boolean {
    const entry = store.get(key);
    if (!entry) return true; // missing = treat as stale
    // CONCEPT: elapsed time = current timestamp minus the timestamp when cached
    return Date.now() - entry.cachedAt > ttlMs;
  },

  invalidate(key: string): void {
    store.delete(key);
  },

  // Clears all entries whose key starts with the given prefix.
  // Lets us invalidate all product-related keys ("products:*") with one call.
  invalidateByPrefix(prefix: string): void {
    // CONCEPT: Map iteration — for..of over store.keys() to find and delete matches
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  },
};
