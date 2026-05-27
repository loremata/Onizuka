import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { requireAdminApiSession } from "@/lib/api-admin-auth";
import { getRegiaDailySheet, parseRegiaDay, saveRegiaDailySheet } from "@/lib/regia-daily-sheet";

export async function GET(request: NextRequest) {
  const session = await requireAdminApiSession("/admin/regia-operativa");
  if (session instanceof NextResponse) return session;
  const dayStr = request.nextUrl.searchParams.get("day") ?? new Date().toISOString().slice(0, 10);
  const payload = await getRegiaDailySheet((session as Session).user.id, parseRegiaDay(dayStr));
  return NextResponse.json({ ok: true, day: dayStr, payload });
}

export async function PUT(request: NextRequest) {
  const session = await requireAdminApiSession("/admin/regia-operativa");
  if (session instanceof NextResponse) return session;
  const body = (await request.json()) as { day?: string; payload?: Record<string, unknown>; closed?: boolean };
  const dayStr = body.day ?? new Date().toISOString().slice(0, 10);
  await saveRegiaDailySheet(
    (session as Session).user.id,
    parseRegiaDay(dayStr),
    body.payload ?? {},
    body.closed
  );
  return NextResponse.json({ ok: true });
}
