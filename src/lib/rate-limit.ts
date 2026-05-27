/**
 * Rate limit: in-memory per processo, oppure Redis globale se `REDIS_URL` è impostato
 * (consigliato con più istanze / serverless). Il login POST resta in-memory nel middleware (Edge).
 */

import { getRateLimitRedis } from "@/lib/rate-limit-redis-client";
import { redisFixedWindow } from "@/lib/rate-limit-redis";

const store = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60 * 1000;

/** Richieste n8n per IP al minuto (prima dell’auth: mitiga brute force su API key). */
const MAX_N8N_INGRESS_PER_IP = 60;

/** Richieste n8n per chiave API (o IP se anonimo) al minuto, dopo auth ok. */
const MAX_N8N_PER_KEY = 120;

/** Mutazioni API admin per utente al minuto (DELETE, toggle webhook, ecc.). */
const MAX_ADMIN_API_PER_USER = 40;

export type RateLimitResult = { ok: true } | { ok: false; retryAfter: number };

function getKey(prefix: string, id: string): string {
  return `${prefix}:${id}`;
}

function cleanup(): void {
  const now = Date.now();
  for (const [key, value] of Array.from(store.entries())) {
    if (value.resetAt < now) store.delete(key);
  }
}

function checkLimitMemory(
  prefix: string,
  identifier: string,
  max: number
): RateLimitResult {
  const key = getKey(prefix, identifier);
  const now = Date.now();

  let entry = store.get(key);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(key, entry);
  }

  entry.count++;
  if (entry.count > max) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true };
}

async function checkLimit(
  prefix: string,
  identifier: string,
  max: number
): Promise<RateLimitResult> {
  const redis = getRateLimitRedis();
  const key = getKey(prefix, identifier);
  if (redis) {
    try {
      return await redisFixedWindow(redis, key, max, WINDOW_MS);
    } catch (e) {
      console.error("[rate-limit] Redis error, using in-memory fallback", e);
    }
  }
  return checkLimitMemory(prefix, identifier, max);
}

export function getRequestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
}

/** Primo stadio: limita per IP tutto il traffico verso /api/n8n (anche 401). */
export async function checkRateLimitN8nIngress(ip: string): Promise<RateLimitResult> {
  return checkLimit("n8n-ingress", ip, MAX_N8N_INGRESS_PER_IP);
}

function getN8nIdentifier(request: Request): string {
  const key = request.headers.get("x-api-key") ?? request.headers.get("authorization") ?? "";
  if (key) return key.slice(0, 48);
  return getRequestIp(request);
}

/** Secondo stadio: dopo autenticazione API key. */
export async function checkRateLimitN8n(request: Request): Promise<RateLimitResult> {
  return checkLimit("n8n", getN8nIdentifier(request), MAX_N8N_PER_KEY);
}

export async function checkRateLimitAdminApi(userId: string): Promise<RateLimitResult> {
  return checkLimit("admin-api", userId, MAX_ADMIN_API_PER_USER);
}

/** Form pubblico segnalatore: max invii per IP al minuto. */
export async function checkRateLimitPublicReferrer(ip: string): Promise<RateLimitResult> {
  return checkLimit("refer-public", ip, 12);
}

if (typeof setInterval !== "undefined") {
  setInterval(cleanup, 60000);
}
