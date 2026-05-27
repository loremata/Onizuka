import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadAdminDashboardStats } from "@/lib/admin-dashboard-stats";
import { resolveRecapDayBounds } from "@/lib/day-bounds";
import { buildVoiceRecapText } from "@/lib/voice-recap";
import { isTelegramConfigured, notifyAdminsViaTelegram } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  if (!isTelegramConfigured()) {
    return NextResponse.json(
      { error: "Telegram non configurato (TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_IDS)." },
      { status: 503 }
    );
  }

  let text: string | undefined;
  try {
    const body = (await req.json()) as { text?: string };
    text = body.text?.trim();
  } catch {
    text = undefined;
  }

  if (!text) {
    const { start, end, timeZoneLabel } = resolveRecapDayBounds({
      userTimeZone: session.user.timeZone,
    });
    const dashboard = await loadAdminDashboardStats(session.user.id, start, end);
    if (!dashboard.ok) {
      return NextResponse.json({ error: "Database non disponibile" }, { status: 503 });
    }
    text = buildVoiceRecapText(dashboard.stats, timeZoneLabel);
  }

  const adminChatIds = (process.env.TELEGRAM_ADMIN_CHAT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (adminChatIds.length === 0) {
    return NextResponse.json(
      { error: "TELEGRAM_ADMIN_CHAT_IDS vuoto: imposta almeno un chat id admin." },
      { status: 503 }
    );
  }

  await notifyAdminsViaTelegram(`📋 Recap Onizuka\n\n${text}`);
  return NextResponse.json({ ok: true, recipients: adminChatIds.length });
}
