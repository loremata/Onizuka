import { getRateLimitRedis } from "@/lib/rate-limit-redis-client";

const QUEUE_KEY = "onizuka:automation:queue";
const DLQ_KEY = "onizuka:automation:dlq";

export function isAutomationRedisQueueEnabled(): boolean {
  return !!process.env.REDIS_URL?.trim();
}

/** Accoda run id su Redis (lista) per worker multi-istanza. */
export async function redisEnqueueAutomationRun(runId: string): Promise<boolean> {
  const redis = getRateLimitRedis();
  if (!redis) return false;
  try {
    await redis.rpush(QUEUE_KEY, runId);
    return true;
  } catch {
    return false;
  }
}

/** Preleva fino a `limit` run id dalla coda Redis. */
export async function redisDequeueAutomationRuns(limit: number): Promise<string[]> {
  const redis = getRateLimitRedis();
  if (!redis || limit <= 0) return [];
  const ids: string[] = [];
  try {
    for (let i = 0; i < limit; i++) {
      const id = await redis.lpop(QUEUE_KEY);
      if (!id) break;
      ids.push(String(id));
    }
  } catch {
    return ids;
  }
  return ids;
}

/** Dead-letter su Redis (oltre tabella Postgres). */
export async function redisPushAutomationDeadLetter(payload: string): Promise<void> {
  const redis = getRateLimitRedis();
  if (!redis) return;
  try {
    await redis.rpush(DLQ_KEY, payload.slice(0, 10000));
    await redis.ltrim(DLQ_KEY, -500, -1);
  } catch {
    /* ignore */
  }
}

export async function redisAutomationQueueDepth(): Promise<{ queue: number; dlq: number }> {
  const redis = getRateLimitRedis();
  if (!redis) return { queue: 0, dlq: 0 };
  try {
    const [queue, dlq] = await Promise.all([redis.llen(QUEUE_KEY), redis.llen(DLQ_KEY)]);
    return { queue, dlq };
  } catch {
    return { queue: 0, dlq: 0 };
  }
}
