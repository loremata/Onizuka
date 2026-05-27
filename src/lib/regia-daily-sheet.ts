import { prisma } from "@/lib/prisma";

export function parseRegiaDay(isoDay: string): Date {
  const d = new Date(isoDay + "T12:00:00");
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getRegiaDailySheet(ownerUserId: string, day: Date) {
  const row = await prisma.regiaDailySheet.findUnique({
    where: { ownerUserId_day: { ownerUserId, day } },
  });
  const raw = row?.payload;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export async function saveRegiaDailySheet(
  ownerUserId: string,
  day: Date,
  payload: Record<string, unknown>,
  closed?: boolean
) {
  return prisma.regiaDailySheet.upsert({
    where: { ownerUserId_day: { ownerUserId, day } },
    create: {
      ownerUserId,
      day,
      payload: payload as object,
      closedAt: closed ? new Date() : null,
    },
    update: {
      payload: payload as object,
      ...(closed !== undefined ? { closedAt: closed ? new Date() : null } : {}),
    },
  });
}
