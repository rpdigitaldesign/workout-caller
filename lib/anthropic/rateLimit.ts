/**
 * A minimal in-memory sliding-window rate limiter for the AI routes.
 * Sufficient at single-user scale — this is not meant to defend a
 * multi-tenant service, just to stop an accidental runaway loop (e.g. a
 * buggy retry) from burning API credits.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;

const requestLog = new Map<string, number[]>();

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    requestLog.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  requestLog.set(key, timestamps);
  return true;
}
