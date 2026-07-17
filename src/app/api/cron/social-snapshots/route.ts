import { NextRequest, NextResponse } from "next/server";
import { jsonApiError } from "@/lib/api-json-errors";
import { prisma } from "@/lib/prisma";
import { collectAccountSnapshot, collectAccountDemographics } from "@/lib/social-account-collector";

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
  if (process.env.SOCIAL_SNAPSHOTS_CRON === "0") {
    return NextResponse.json({ ok: true, disabled: true });
  }

  const accounts = await prisma.socialAccount.findMany({
    where: { status: "CONNECTED" },
    take: 100,
  });

  let written = 0;
  let skipped = 0;
  let failed = 0;
  const errors: { accountId: string; error: string }[] = [];

  for (const acc of accounts) {
    const r = await collectAccountSnapshot(acc);
    if ("ok" in r) written += r.written;
    else if ("skipped" in r) skipped++;
    else {
      failed++;
      errors.push({ accountId: acc.id, error: r.error });
    }
    // Demografici (best-effort: non blocca lo snapshot se non disponibili)
    const d = await collectAccountDemographics(acc);
    if ("ok" in d) written += d.written;
  }

  return NextResponse.json({ ok: true, scanned: accounts.length, written, skipped, failed, errors });
}
