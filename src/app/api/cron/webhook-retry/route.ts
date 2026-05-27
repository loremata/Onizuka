import { NextRequest, NextResponse } from "next/server";
import { jsonApiError } from "@/lib/api-json-errors";
import { runWebhookDeliveryRetries } from "@/lib/webhook-retry-cron";

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

  const result = await runWebhookDeliveryRetries();
  return NextResponse.json({ ok: true, ...result });
}
