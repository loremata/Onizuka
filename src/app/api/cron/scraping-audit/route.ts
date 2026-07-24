// Cron: processa la coda audit da scraping, a piccoli lotti, con tetto giornaliero.
// Schedulato ogni 3h (vercel.json). Ogni run fa max `limit` audit e comunque
// non oltre SCRAPING_AUDIT_DAILY_CAP (default 20) al giorno.
import { NextRequest, NextResponse } from "next/server";
import { timingSafeStrEqual } from "@/lib/timing-safe-str";
import { jsonApiError } from "@/lib/api-json-errors";
import { processScrapingAuditBatch } from "@/lib/scraping-audit-queue";

// Ogni audit fa probe sito + Google Places: può durare. Alziamo il limite.
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
  const limit = Math.min(10, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? "4")));
  const result = await processScrapingAuditBatch(limit);
  return NextResponse.json({ ok: true, ...result });
}
