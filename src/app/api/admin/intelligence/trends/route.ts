import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { requireAdminApiSession } from "@/lib/api-admin-auth";
import { loadIntelligenceTrends } from "@/lib/intelligence-trends";

export async function GET(request: NextRequest) {
  const session = await requireAdminApiSession("/admin/intelligence");
  if (session instanceof NextResponse) return session;
  const daysRaw = Number.parseInt(request.nextUrl.searchParams.get("days") ?? "30", 10);
  const days = Number.isFinite(daysRaw) ? daysRaw : 30;
  const data = await loadIntelligenceTrends((session as Session).user.id, days);
  return NextResponse.json({ ok: true, data });
}
