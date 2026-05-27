import { Redis } from "@upstash/redis";

const KEY_PREFIX = "onizuka:nrev:";

let busRedis: Redis | null | undefined;

function getBusRedis(): Redis | null {
  if (busRedis !== undefined) return busRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    busRedis = null;
    return null;
  }
  busRedis = new Redis({ url, token });
  return busRedis;
}

export function isNotificationBusEnabled(): boolean {
  return getBusRedis() !== null;
}

/** Pubblica revisione notifiche su Redis (multi-istanza Vercel). */
export async function publishNotificationRevs(
  entries: Array<{ userId: string; rev: number }>
): Promise<void> {
  const redis = getBusRedis();
  if (!redis || entries.length === 0) return;

  await Promise.allSettled(
    entries.map(({ userId, rev }) => redis.set(`${KEY_PREFIX}${userId}`, rev, { ex: 86_400 }))
  );
}

export async function readNotificationRevFromBus(userId: string): Promise<number | null> {
  const redis = getBusRedis();
  if (!redis) return null;
  try {
    const v = await redis.get<number>(`${KEY_PREFIX}${userId}`);
    return typeof v === "number" ? v : null;
  } catch {
    return null;
  }
}
