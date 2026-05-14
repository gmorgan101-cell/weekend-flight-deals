// Simple in-memory cache with TTL
// Persists across requests while the server process is alive

const cache = new Map<string, { data: unknown; timestamp: number }>();

const DEFAULT_TTL = 4 * 60 * 60 * 1000; // 4 hours

export function getCached<T>(key: string, ttlMs: number = DEFAULT_TTL): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() });
}
