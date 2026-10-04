/**
 * High-performance TTL cache for eliminating remote database network waterfalls.
 */
export class FastTtlCache<K, V> {
  private readonly store = new Map<K, { value: V; expiresAt: number }>();

  constructor(private readonly defaultTtlMs: number = 30_000) {}

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V, ttlMs: number = this.defaultTtlMs): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: K): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  async getOrSet(key: K, fetcher: () => Promise<V>, ttlMs?: number): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await fetcher();
    this.set(key, value, ttlMs);
    return value;
  }
}

// Global process-level caches
export const userSummaryCache = new FastTtlCache<string, any>(60_000); // 60s
export const rootFolderCache = new FastTtlCache<string, any>(120_000); // 120s
export const accessCache = new FastTtlCache<string, any>(15_000); // 15s for file/folder access checks
export const folderNameCache = new FastTtlCache<string, string>(60_000); // 60s
export const folderDetailCache = new FastTtlCache<string, any>(30_000); // 30s
