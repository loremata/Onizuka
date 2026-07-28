import { NextRequest, NextResponse } from "next/server";
import { timingSafeStrEqual } from "@/lib/timing-safe-str";
import { jsonApiError } from "@/lib/api-json-errors";
import { runWebhookDeliveryRetries } from "@/lib/webhook-retry-cron";
import { withCronRun } from "@/lib/cron-run";
import { runCronWatchdog } from "@/lib/cron-watchdog";

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

  const result = await runWebhookDeliveryRetries();

  // La sveglia sui lavori notturni vive QUI, nel cron più frequente e più
  // semplice: se stesse in quello giornaliero, un guasto di quel job
  // spegnerebbe anche la sveglia. Best-effort, non fa fallire il retry.
  const watchdog = await runCronWatchdog().catch(() => null);

  return NextResponse.json({ ok: true, ...result, watchdog });
}

// Ogni esecuzione lascia una riga in CronRun: e' cosi' che si vede se gira ancora.
export const GET = withCronRun("webhook-retry", cronHandler);
