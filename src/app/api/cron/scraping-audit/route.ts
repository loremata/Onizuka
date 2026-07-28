// Cron: processa la coda audit da scraping, a piccoli lotti, con tetto giornaliero.
// Schedulato ogni 3h (vercel.json). Ogni run fa max `limit` audit e comunque
// non oltre SCRAPING_AUDIT_DAILY_CAP (default 50) al giorno.
// In coda al run: recupero contatti per i lead con sito ma senza email reale
// (quelli che un audit non lo avranno mai, o l'hanno avuto prima che
// l'estrazione contatti esistesse).
import { NextRequest, NextResponse } from "next/server";
import { timingSafeStrEqual } from "@/lib/timing-safe-str";
import { jsonApiError } from "@/lib/api-json-errors";
import { processScrapingAuditBatch } from "@/lib/scraping-audit-queue";
import { enrichPendingLeadContacts } from "@/lib/contact-enrichment";

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

  // Recupero contatti: 3 lead per run × 8 run/giorno = ~24 siti sondati al
  // giorno. Best-effort: un errore qui non deve far fallire il run della coda.
  const enrichment = await enrichPendingLeadContacts(3).catch(() => null);

  return NextResponse.json({ ok: true, ...result, enrichment });
}
