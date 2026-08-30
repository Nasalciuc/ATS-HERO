/**
 * Fixed-window, in-memory rate limiter. Per-instance state is deliberate for the solo stage:
 * it costs nothing and stops accidental hammering. Pre-registered trigger — first real abuse
 * swaps this for Upstash, keeping the same `allow()` signature.
 */
type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
const MAX_KEYS = 10_000;

export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const w = windows.get(key);

  if (!w || now >= w.resetAt) {
    // Cheap eviction: the map only grows on a hot path, so prune expired entries on rollover.
    if (windows.size > MAX_KEYS) {
      for (const [k, v] of windows) if (now >= v.resetAt) windows.delete(k);
    }
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (w.count >= limit) return false;
  w.count += 1;
  return true;
}
