// Sliding-window rate limiter for the paid API routes, keyed per user + route by lib/auth.ts.
// In-memory on purpose: state is per server instance, which is exact on a single Node process
// (local dev, one container) and merely lenient under serverless fan-out — each instance
// enforces the window independently, so the worst case is N instances × the limit, still a
// ceiling where before there was none. Swap the Map for Redis/Upstash if that ever matters.

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

// key -> timestamps (ms) of requests inside the current window, oldest first.
const hits = new Map<string, number[]>();

// Bounds the map when many distinct users/routes come and go; entries whose window has fully
// expired are dropped. Cheap enough to run inline on the rare call that crosses the threshold.
const SWEEP_THRESHOLD = 1_000;
function sweep(cutoff: number) {
  for (const [key, times] of hits) {
    if (times.length === 0 || times[times.length - 1] <= cutoff) hits.delete(key);
  }
}

/**
 * Records a hit for `key` and reports whether it exceeded the limit. Refused calls are not
 * recorded, so a client that keeps retrying gets through as soon as the window drains.
 */
export function rateLimited(
  key: string,
  limit: number = MAX_PER_WINDOW,
  windowMs: number = WINDOW_MS,
): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  if (hits.size > SWEEP_THRESHOLD) sweep(cutoff);

  const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}
