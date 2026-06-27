import { NextRequest, NextResponse } from "next/server";
import { jsonApiError } from "@/lib/api-json-errors";
import { processAuditSheetQueueBatch } from "@/lib/audit-sheet-queue-processor";
import { prisma } from "@/lib/prisma";
import { syncAuditSheetQueue } from "@/lib/audit-sheet-ingest";

// Il batch esegue fino a 10 audit sequenziali (probe sito + Google Places): può
// durare diversi minuti. Alziamo il limite di esecuzione per evitare timeout a
// metà batch (con il recupero orfani le righe interrotte vengono comunque riprese).
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

  const limit = Math.min(20, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? "5")));
  let synced: { owners: number; enqueued: number } | undefined;

  if (process.env.GOOGLE_SHEET_AUTO_SYNC_CRON === "1") {
    const owners = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "STAFF"] } },
      select: { id: true },
      take: 20,
    });
    let enqueued = 0;
    for (const o of owners) {
      try {
        const r = await syncAuditSheetQueue(o.id);
        enqueued += r.enqueued;
      } catch {
        /* skip owner */
      }
    }
    synced = { owners: owners.length, enqueued };
  }

  const result = await processAuditSheetQueueBatch(limit);
  return NextResponse.json({ ok: true, synced, ...result });
}
