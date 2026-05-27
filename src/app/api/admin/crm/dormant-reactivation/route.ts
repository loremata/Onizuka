import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { requireAdminApiSession } from "@/lib/api-admin-auth";
import { getDormantClients } from "@/lib/dormant-reactivation";

export async function GET() {
  const session = await requireAdminApiSession("/admin");
  if (session instanceof NextResponse) return session;
  const items = await getDormantClients((session as Session).user.id);
  return NextResponse.json({ ok: true, items });
}
