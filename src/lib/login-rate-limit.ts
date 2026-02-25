/**
 * In-memory login attempt rate limit for middleware (Edge).
 * Key = IP, value = { count, resetAt }. 10 attempts per minute.
 */

const LOGIN_WINDOW_MS = 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

const store = new Map<string, { count: number; resetAt: number }>();

export function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  let entry = store.get(ip);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
    store.set(ip, entry);
  }
  entry.count++;
  return entry.count > LOGIN_MAX_ATTEMPTS;
}
