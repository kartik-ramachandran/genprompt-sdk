interface CacheEntry<T> {
  value: T
  expiresAt: number
  revalidating: boolean
}

/**
 * In-memory stale-while-revalidate cache.
 * Serves stale values instantly and refreshes in the background.
 */
export class PromptCache {
  private store = new Map<string, CacheEntry<unknown>>()

  get<T>(key: string): { value: T; stale: boolean } | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined
    if (!entry) return null
    const stale = Date.now() > entry.expiresAt
    return { value: entry.value, stale }
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
      revalidating: false,
    })
  }

  markRevalidating(key: string): void {
    const entry = this.store.get(key)
    if (entry) entry.revalidating = true
  }

  isRevalidating(key: string): boolean {
    return this.store.get(key)?.revalidating ?? false
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }
}
