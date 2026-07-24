import { NextResponse } from "next/server";
import { handleTelegramUpdate, type TelegramUpdate } from "@/lib/telegram-bot";
import { timingSafeStrEqual } from "@/lib/timing-safe-str";

/** Webhook Telegram Bot API. */
export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, reason: "TELEGRAM_BOT_TOKEN non configurato" });
  }

  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (webhookSecret) {
    // Secret configurato: confronto timing-safe obbligatorio.
    if (!timingSafeStrEqual(secret, webhookSecret)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // In produzione un webhook Telegram senza secret è insicuro → rifiutiamo (fail-closed).
    // In sviluppo restiamo permissivi per non bloccare i test locali.
    return NextResponse.json(
      { error: "TELEGRAM_WEBHOOK_SECRET non configurato" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as TelegramUpdate;
  await handleTelegramUpdate(body);
  return NextResponse.json({ ok: true });
}
