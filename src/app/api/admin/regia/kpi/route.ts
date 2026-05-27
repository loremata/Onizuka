import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { requireAdminApiSession } from "@/lib/api-admin-auth";
import { computeRegiaKpis } from "@/lib/regia-kpi";

export async function GET() {
  const session = await requireAdminApiSession("/admin/regia-operativa");
  if (session instanceof NextResponse) return session;
  const kpi = await computeRegiaKpis((session as Session).user.id);
  return NextResponse.json({ ok: true, kpi });
}
