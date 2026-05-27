import type { Redis } from "ioredis";

export type RateLimitOutcome = { ok: true } | { ok: false; retryAfter: number };

/**
 * Finestra fissa: prima richiesta imposta TTL; INCR atomico.
 * Prefisso chiavi gestito dal chiamante (es. `n8n-ingress:1.2.3.4`).
 */
export async function redisFixedWindow(
  redis: Redis,
  key: string,
  max: number,
  windowMs: number
): Promise<RateLimitOutcome> {
  const fullKey = `portal-rl:${key}`;
  const n = await redis.incr(fullKey);
  if (n === 1) {
    await redis.pexpire(fullKey, windowMs);
  }
  if (n > max) {
    const pttl = await redis.pttl(fullKey);
    const retryAfter = pttl > 0 ? Math.ceil(pttl / 1000) : Math.ceil(windowMs / 1000);
    return { ok: false, retryAfter };
  }
  return { ok: true };
}
