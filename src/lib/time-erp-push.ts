import { prisma } from "@/lib/prisma";
import { formatTimeEntriesForErpVendor, type ErpVendor } from "@/lib/time-erp-vendors";

export type TimeErpPushResult =
  | { ok: true; entryCount: number; vendor: ErpVendor }
  | { ok: false; error: string };

export async function pushTimeEntriesToErpWebhook(params: {
  ownerUserId: string;
  vendor?: ErpVendor;
}): Promise<TimeErpPushResult> {
  const url = process.env.TIME_ERP_WEBHOOK_URL?.trim();
  if (!url) {
    return { ok: false, error: "TIME_ERP_WEBHOOK_URL non configurato." };
  }

  const vendor = params.vendor ?? "generic";
  const rows = await prisma.timeEntry.findMany({
    where: { ownerUserId: params.ownerUserId },
    orderBy: { workedAt: "desc" },
    take: 5000,
    include: {
      client: { select: { companyName: true } },
      owner: { select: { email: true } },
    },
  });

  const csv = formatTimeEntriesForErpVendor(rows, vendor);
  const secret = process.env.TIME_ERP_WEBHOOK_SECRET?.trim();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify({
      source: "onizuka",
      vendor,
      entryCount: rows.length,
      exportedAt: new Date().toISOString(),
      csv,
      entries: rows.map((r) => ({
        id: r.id,
        workedAt: r.workedAt.toISOString(),
        minutes: r.minutes,
        description: r.description,
        projectCode: r.projectCode,
        clientName: r.client?.companyName ?? null,
        billable: r.billable,
        approvedAt: r.approvedAt?.toISOString() ?? null,
        secondApprovedAt: r.secondApprovedAt?.toISOString() ?? null,
      })),
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    await prisma.timeErpPushLog.create({
      data: {
        ownerUserId: params.ownerUserId,
        vendor,
        entryCount: rows.length,
        ok: false,
        errorDetail: `${res.status}: ${err.slice(0, 500)}`,
      },
    });
    return { ok: false, error: `ERP webhook ${res.status}: ${err.slice(0, 200)}` };
  }

  await prisma.timeErpPushLog.create({
    data: {
      ownerUserId: params.ownerUserId,
      vendor,
      entryCount: rows.length,
      ok: true,
    },
  });

  return { ok: true, entryCount: rows.length, vendor };
}
