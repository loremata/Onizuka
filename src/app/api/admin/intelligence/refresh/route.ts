import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { requireAdminApiSession } from "@/lib/api-admin-auth";
import { refreshIntelligenceRecommendations, listIntelligenceRecommendations } from "@/lib/intelligence-nba";

export async function POST() {
  const session = await requireAdminApiSession("/admin/intelligence");
  if (session instanceof NextResponse) return session;
  const ownerId = (session as Session).user.id;
  const created = await refreshIntelligenceRecommendations(ownerId);
  const items = await listIntelligenceRecommendations(ownerId);
  return NextResponse.json({ ok: true, created, items });
}

export async function GET() {
  const session = await requireAdminApiSession("/admin/intelligence");
  if (session instanceof NextResponse) return session;
  const items = await listIntelligenceRecommendations((session as Session).user.id);
  return NextResponse.json({ ok: true, items });
}
