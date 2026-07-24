import { NextRequest, NextResponse } from "next/server";
import { timingSafeStrEqual } from "@/lib/timing-safe-str";
import { jsonApiError } from "@/lib/api-json-errors";
import { prisma } from "@/lib/prisma";
import { collectGa4ForConnection } from "@/lib/ga4-collector";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (timingSafeStrEqual(header, `Bearer ${secret}`)) return true;
  return timingSafeStrEqual(request.headers.get("x-cron-secret"), secret);
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return jsonApiError(401, "UNAUTHORIZED", "Non autorizzato.");
  }
  if (process.env.ANALYTICS_GA4_CRON === "0") {
    return NextResponse.json({ ok: true, disabled: true });
  }

  const conns = await prisma.analyticsConnection.findMany({
    where: { source: "GA4", status: "CONNECTED" },
    take: 50,
  });

  let synced = 0;
  let failed = 0;
  const errors: { connectionId: string; error: string }[] = [];

  for (const conn of conns) {
    const r = await collectGa4ForConnection(conn);
    if ("ok" in r) {
      synced++;
    } else {
      failed++;
      errors.push({ connectionId: conn.id, error: r.error });
      await prisma.analyticsConnection.update({
        where: { id: conn.id },
        data: { lastError: r.error.slice(0, 500) },
      });
    }
  }

  return NextResponse.json({ ok: true, scanned: conns.length, synced, failed, errors });
}
