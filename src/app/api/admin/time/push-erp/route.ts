import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminAreaRole } from "@/lib/auth-roles";
import { pushTimeEntriesToErpWebhook } from "@/lib/time-erp-push";
import type { ErpVendor } from "@/lib/time-erp-vendors";

function parseVendor(raw: string | null): ErpVendor {
  const v = raw?.trim().toLowerCase();
  if (v === "zucchetti") return "zucchetti";
  if (v === "teamsystem") return "teamsystem";
  return "generic";
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isAdminAreaRole(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const vendor = parseVendor(typeof body.vendor === "string" ? body.vendor : null);

  const result = await pushTimeEntriesToErpWebhook({
    ownerUserId: session.user.id,
    vendor,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json(result);
}
