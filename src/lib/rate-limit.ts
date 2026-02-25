/**
 * In-memory rate limiter. Use for n8n API routes (per key or IP).
 * In serverless, each instance has its own store; for strict limits use Redis or similar.
 */

const store = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_N8N = 120; // per key or IP per minute

function getKey(prefix: string, id: string): string {
  return `${prefix}:${id}`;
}

function cleanup(): void {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (value.resetAt < now) store.delete(key);
  }
}

export function checkRateLimitN8n(identifier: string): { ok: true } | { ok: false; retryAfter: number } {
  const key = getKey("n8n", identifier);
  const now = Date.now();

  let entry = store.get(key);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(key, entry);
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS_N8N) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true };
}

// Run cleanup occasionally to avoid unbounded growth
if (typeof setInterval !== "undefined") {
  setInterval(cleanup, 60000);
}
