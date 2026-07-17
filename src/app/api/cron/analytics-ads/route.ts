import { NextRequest, NextResponse } from "next/server";
import { jsonApiError } from "@/lib/api-json-errors";
import { prisma } from "@/lib/prisma";
import { collectMetaAdsForConnection, collectGoogleAdsForConnection } from "@/lib/ads-collector";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return request.headers.get("x-cron-secret") === secret;
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return jsonApiError(401, "UNAUTHORIZED", "Non autorizzato.");
  }
  if (process.env.ANALYTICS_ADS_CRON === "0") {
    return NextResponse.json({ ok: true, disabled: true });
  }

  const conns = await prisma.analyticsConnection.findMany({
    where: { source: { in: ["META_ADS", "GOOGLE_ADS"] }, status: "CONNECTED" },
    take: 100,
  });

  let synced = 0;
  let written = 0;
  let failed = 0;
  const errors: { connectionId: string; error: string }[] = [];

  for (const conn of conns) {
    const r =
      conn.source === "META_ADS"
        ? await collectMetaAdsForConnection(conn)
        : await collectGoogleAdsForConnection(conn);
    if ("ok" in r) {
      synced++;
      written += r.written;
      await prisma.analyticsConnection.update({ where: { id: conn.id }, data: { lastSyncAt: new Date(), lastError: null } });
    } else {
      failed++;
      errors.push({ connectionId: conn.id, error: r.error });
      await prisma.analyticsConnection.update({ where: { id: conn.id }, data: { lastError: r.error.slice(0, 500) } });
    }
  }

  return NextResponse.json({ ok: true, scanned: conns.length, synced, written, failed, errors });
}
