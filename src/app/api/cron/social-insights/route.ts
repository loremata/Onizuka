import { NextRequest, NextResponse } from "next/server";
import { jsonApiError } from "@/lib/api-json-errors";
import { prisma } from "@/lib/prisma";
import { generateAndStoreInsights } from "@/lib/social-insights-store";

// Il panel fa più chiamate LLM per cliente: alziamo il limite di esecuzione.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const RECENT_DAYS = 30;

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
  if (process.env.SOCIAL_INSIGHTS_CRON === "0") {
    return NextResponse.json({ ok: true, disabled: true });
  }

  const limit = Math.min(30, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? "15")));
  const since = new Date(Date.now() - RECENT_DAYS * 24 * 3600 * 1000);

  // Clienti con contenuti pubblicati di recente: solo per loro ha senso rigenerare gli insight.
  const clients = await prisma.client.findMany({
    where: { posts: { some: { publishedAt: { not: null, gte: since } } } },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true },
  });

  let refreshed = 0;
  let aiGenerated = 0;
  let failed = 0;
  const errors: { clientId: string; error: string }[] = [];

  for (const c of clients) {
    try {
      const panel = await generateAndStoreInsights(c.id);
      refreshed++;
      if (panel.aiGenerated) aiGenerated++;
    } catch (e) {
      failed++;
      errors.push({ clientId: c.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ ok: true, scanned: clients.length, refreshed, aiGenerated, failed, errors });
}
