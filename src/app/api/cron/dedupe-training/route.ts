import { NextRequest, NextResponse } from "next/server";
import { timingSafeStrEqual } from "@/lib/timing-safe-str";
import { jsonApiError } from "@/lib/api-json-errors";
import { processNextDedupeGpuTrainingJob } from "@/lib/dedupe-training-gpu";
import { withCronRun } from "@/lib/cron-run";

// Training del modello duplicati: un job per giro, puo' durare.
export const maxDuration = 300;
// Obbligatorio: senza, Next prova a pre-renderizzare la route in fase di
// build, l'handler legge gli header e il build registra un finto giro fallito.
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

  const result = await processNextDedupeGpuTrainingJob();
  return NextResponse.json(result);
}

// Ogni esecuzione lascia una riga in CronRun: e' cosi' che si vede se gira ancora.
export const GET = withCronRun("dedupe-training", cronHandler);
