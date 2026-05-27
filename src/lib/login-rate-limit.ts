/**
 * Login POST rate limit (middleware / Edge).
 * Con `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`: contatore globale via HTTP (Upstash).
 * Altrimenti in-memory per istanza (stesso comportamento di prima).
 * 10 richieste per finestra da 60s per IP; superata la soglia → true (blocca).
 */

import { Ratelimit } from "@upstash/ratelimit";
/** Client fetch-only (no `process.version`): compatibile col middleware Edge. */
import { Redis } from "@upstash/redis/cloudflare";

const LOGIN_WINDOW_MS = 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

const store = new Map<string, { count: number; resetAt: number }>();

const g = globalThis as typeof globalThis & { __portalLoginRatelimit?: Ratelimit };

function getUpstashLoginRatelimit(): Ratelimit | undefined {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return undefined;
  if (!g.__portalLoginRatelimit) {
    const redis = new Redis({ url, token });
    g.__portalLoginRatelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(LOGIN_MAX_ATTEMPTS, "60 s"),
      prefix: "portal-login",
    });
  }
  return g.__portalLoginRatelimit;
}

function checkLoginRateLimitMemory(ip: string): boolean {
  const now = Date.now();
  let entry = store.get(ip);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
    store.set(ip, entry);
  }
  entry.count++;
  return entry.count > LOGIN_MAX_ATTEMPTS;
}

/** @returns true se la richiesta va bloccata (429). */
export async function checkLoginRateLimit(ip: string): Promise<boolean> {
  const rl = getUpstashLoginRatelimit();
  if (rl) {
    try {
      const { success } = await rl.limit(ip);
      return !success;
    } catch (e) {
      console.error("[login-rate-limit] Upstash error, using in-memory fallback", e);
      return checkLoginRateLimitMemory(ip);
    }
  }
  return checkLoginRateLimitMemory(ip);
}

// Evita warning se il modulo viene analizzato senza timer (es. alcuni bundler).
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of Array.from(store.entries())) {
      if (value.resetAt < now) store.delete(key);
    }
  }, LOGIN_WINDOW_MS);
}
