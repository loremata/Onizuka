import { isPrismaConnectionError } from "@/lib/prisma-errors";

export type DbRunResult<T> = { ok: true; data: T } | { ok: false; reason: "unavailable" };

export async function runWithDb<T>(fn: () => Promise<T>): Promise<DbRunResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (isPrismaConnectionError(error)) {
      return { ok: false, reason: "unavailable" };
    }
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Can't reach database server")) {
      return { ok: false, reason: "unavailable" };
    }
    throw error;
  }
}
