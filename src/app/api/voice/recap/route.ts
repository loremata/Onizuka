import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadAdminDashboardStats } from "@/lib/admin-dashboard-stats";
import { resolveRecapDayBounds } from "@/lib/day-bounds";
import { buildVoiceRecapText } from "@/lib/voice-recap";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { start, end, timeZoneLabel } = resolveRecapDayBounds({
    userTimeZone: session.user.timeZone,
  });
  const dashboard = await loadAdminDashboardStats(session.user.id, start, end);
  if (!dashboard.ok) {
    return NextResponse.json({ error: "Database non disponibile" }, { status: 503 });
  }

  const text = buildVoiceRecapText(dashboard.stats, timeZoneLabel);
  return NextResponse.json({
    text,
    mode: "rule_based_mvp",
    tts: process.env.VOICE_TTS_PROVIDER ?? "not_configured",
  });
}
