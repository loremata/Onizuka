import { NextRequest, NextResponse } from "next/server";
import { timingSafeStrEqual } from "@/lib/timing-safe-str";
import { jsonApiError } from "@/lib/api-json-errors";
import { prisma } from "@/lib/prisma";
import { refreshPostItemMetrics } from "@/lib/social-metrics";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

// Aggiorna solo i post pubblicati di recente: le metriche vecchie sono stabili.
const RECENT_DAYS = 30;

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
  if (process.env.SOCIAL_METRICS_CRON === "0") {
    return NextResponse.json({ ok: true, disabled: true });
  }

  const limit = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? "20")));
  const since = new Date(Date.now() - RECENT_DAYS * 24 * 3600 * 1000);

  // Post pubblicati via account collegato (multi-tenant) con riferimento esterno noto.
  const posts = await prisma.postItem.findMany({
    where: {
      publishedAt: { not: null, gte: since },
      socialAccountId: { not: null },
      externalRef: { not: null },
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: { id: true },
  });

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const errors: { postId: string; error: string }[] = [];

  for (const p of posts) {
    const r = await refreshPostItemMetrics(p.id);
    if ("ok" in r) {
      if (r.updated) updated++;
      else skipped++;
    } else if ("skipped" in r) {
      skipped++;
    } else {
      failed++;
      errors.push({ postId: p.id, error: r.error });
    }
  }

  return NextResponse.json({ ok: true, scanned: posts.length, updated, skipped, failed, errors });
}
