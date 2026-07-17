import { NextRequest, NextResponse } from "next/server";
import { jsonApiError } from "@/lib/api-json-errors";
import { prisma } from "@/lib/prisma";
import { publishPostItemNative } from "@/lib/social-publish-native";

// Pubblicazione può fare N chiamate Graph/LinkedIn in sequenza: alziamo il limite.
export const maxDuration = 120;
export const dynamic = "force-dynamic";

// Cap tentativi per evitare che un post che fallisce di continuo blocchi la coda.
const MAX_ATTEMPTS = 3;

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
  if (process.env.SOCIAL_PUBLISH_CRON === "0") {
    return NextResponse.json({ ok: true, disabled: true });
  }

  const limit = Math.min(25, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? "10")));
  const now = new Date();

  // Solo post APPROVATI dal cliente, programmati e scaduti, CON account collegato
  // (opt-in esplicito al publish nativo multi-tenant). I post senza socialAccountId
  // restano sul flusso legacy (n8n / pubblicazione manuale) e non vengono toccati.
  const due = await prisma.postItem.findMany({
    where: {
      status: "APPROVED",
      publishedAt: null,
      socialAccountId: { not: null },
      scheduledFor: { not: null, lte: now },
      publishAttempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
    select: { id: true },
  });

  let published = 0;
  let failed = 0;
  const errors: { postId: string; error: string }[] = [];

  for (const p of due) {
    // Incrementa il tentativo PRIMA di provare: se il processo muore a metà,
    // il post non resta in loop infinito.
    await prisma.postItem.update({
      where: { id: p.id },
      data: { publishAttempts: { increment: 1 } },
    });

    const result = await publishPostItemNative(p.id);
    if ("ok" in result) {
      published++;
    } else {
      failed++;
      errors.push({ postId: p.id, error: result.error });
      await prisma.postItem.update({
        where: { id: p.id },
        data: { errorDetail: result.error.slice(0, 500) },
      });
    }
  }

  return NextResponse.json({ ok: true, scanned: due.length, published, failed, errors });
}
