/**
 * Fixed-window, in-memory rate limiter. Per-instance state is deliberate for the solo stage:
 * it costs nothing and stops accidental hammering. Pre-registered trigger — first real abuse
 * swaps this for Upstash, keeping the same `allow()` signature.
 */
type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
export const MAX_KEYS = 10_000;

export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = windows.get(key);
  if (existing && now < existing.resetAt) {
    if (existing.count >= limit) return false;
    existing.count++; return true;
  }
  if (windows.size >= MAX_KEYS) {
    for (const [k, v] of windows) if (now >= v.resetAt) windows.delete(k);
    if (windows.size >= MAX_KEYS) return false;             // still full after cleanup? reject new key
  }
  windows.set(key, { count: 1, resetAt: now + windowMs });
  return true;
}

/** Test-only: wipe the in-memory map so cases cannot leak into each other. */
export function resetRateLimitForTests() {
  windows.clear();
}
