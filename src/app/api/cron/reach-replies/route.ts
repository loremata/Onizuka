import { NextRequest, NextResponse } from "next/server";
import { timingSafeStrEqual } from "@/lib/timing-safe-str";
import { jsonApiError } from "@/lib/api-json-errors";
import { checkOutreachEmailReplies } from "@/lib/outreach-reply-watch";
import { withCronRun } from "@/lib/cron-run";

/**
 * Watcher delle risposte email (IMAP): chi risponde esce dai follow-up.
 * È il prerequisito per lasciare gli invii automatici accesi in coscienza.
 */
export const maxDuration = 120;
export const dynamic = "force-dynamic";

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (timingSafeStrEqual(header, `Bearer ${secret}`)) return true;
  return timingSafeStrEqual(request.headers.get("x-cron-secret"), secret);
}

async function cronHandler(request: NextRequest) {
  if (!authorizeCron(request)) {
    return jsonApiError(401, "UNAUTHORIZED", "Non autorizzato.");
  }

  const result = await checkOutreachEmailReplies();
  return NextResponse.json({ ok: true, ...result });
}

export const GET = withCronRun("reach-replies", cronHandler);
