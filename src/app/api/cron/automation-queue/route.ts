import { NextRequest, NextResponse } from "next/server";
import { timingSafeStrEqual } from "@/lib/timing-safe-str";
import { jsonApiError } from "@/lib/api-json-errors";
import { processAutomationFlowQueue } from "@/lib/automation-flow-queue";
import { withCronRun } from "@/lib/cron-run";

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

  const result = await processAutomationFlowQueue(30);
  return NextResponse.json(result);
}

// Ogni esecuzione lascia una riga in CronRun: e' cosi' che si vede se gira ancora.
export const GET = withCronRun("automation-queue", cronHandler);
