import Redis from "ioredis";

const g = globalThis as typeof globalThis & { __approvalPortalRateLimitRedis?: Redis };

export function getRateLimitRedis(): Redis | undefined {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return undefined;
  if (!g.__approvalPortalRateLimitRedis) {
    g.__approvalPortalRateLimitRedis = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });
  }
  return g.__approvalPortalRateLimitRedis;
}
