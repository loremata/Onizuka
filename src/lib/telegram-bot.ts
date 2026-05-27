const API = "https://api.telegram.org";

export type TelegramInlineButton = {
  text: string;
  callback_data?: string;
  url?: string;
};

export type TelegramInlineKeyboard = {
  inline_keyboard: TelegramInlineButton[][];
};

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  replyMarkup?: TelegramInlineKeyboard
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return false;

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: text.slice(0, 4000),
    disable_web_page_preview: true,
  };
  if (replyMarkup) body.reply_markup = replyMarkup;

  const res = await fetch(`${API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export async function notifyAdminsViaTelegram(
  text: string,
  replyMarkup?: TelegramInlineKeyboard
): Promise<void> {
  const chatIds = (process.env.TELEGRAM_ADMIN_CHAT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (chatIds.length === 0) return;
  await Promise.allSettled(chatIds.map((id) => sendTelegramMessage(id, text, replyMarkup)));
}

async function answerCallbackQuery(callbackQueryId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return;
  await fetch(`${API}/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text.slice(0, 200),
      show_alert: text.length > 80,
    }),
  });
}

export type TelegramUpdate = {
  message?: {
    chat: { id: number };
    text?: string;
    from?: { first_name?: string };
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number } };
    from?: { id: number };
  };
};

async function handleTelegramCallback(callback: NonNullable<TelegramUpdate["callback_query"]>): Promise<void> {
  const chatId = callback.message?.chat.id;
  const data = callback.data?.trim() ?? "";
  if (!chatId || !data) return;

  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://onizuka.it";

  if (data.startsWith("oa:")) {
    const draftId = data.slice(3);
    const { approveOutreachFromTelegram } = await import("@/lib/outreach-telegram-actions");
    const result = await approveOutreachFromTelegram(draftId, chatId);
    await answerCallbackQuery(callback.id, result.message);
    if (result.ok) {
      await sendTelegramMessage(chatId, `Reach · ${result.message}`);
    }
    return;
  }

  if (data.startsWith("oe:")) {
    const draftId = data.slice(3);
    await answerCallbackQuery(callback.id, "Apri Reach per modificare");
    await sendTelegramMessage(chatId, `Modifica bozza:\n${base}/admin/reach`);
    return;
  }

  if (data.startsWith("op:")) {
    const draftId = data.slice(3);
    const { postponeOutreachFromTelegram } = await import("@/lib/outreach-telegram-actions");
    const result = await postponeOutreachFromTelegram(draftId, chatId);
    await answerCallbackQuery(callback.id, result.message);
    return;
  }

  if (data.startsWith("av:")) {
    const auditId = data.slice(3);
    await answerCallbackQuery(callback.id, "Audit");
    await sendTelegramMessage(chatId, `Audit digitale:\n${base}/admin/audit/digital/${auditId}`);
    return;
  }

  await answerCallbackQuery(callback.id, "Azione non riconosciuta");
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  if (update.callback_query) {
    await handleTelegramCallback(update.callback_query);
    return;
  }

  const text = update.message?.text?.trim() ?? "";
  const chatId = update.message?.chat.id;
  if (!chatId || !text) return;

  if (text === "/start" || text === "/help") {
    await sendTelegramMessage(
      chatId,
      "Onizuka bot operativo. Comandi: /status — stato app. Alert admin configurati via TELEGRAM_ADMIN_CHAT_IDS."
    );
    return;
  }

  if (text === "/status") {
    const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://onizuka.it";
    await sendTelegramMessage(chatId, `Onizuka OK\nHealth: ${base}/api/health`);
    return;
  }

  const adminIds = (process.env.TELEGRAM_ADMIN_CHAT_IDS ?? "")
    .split(",")
    .map((s) => s.trim());
  if (adminIds.includes(String(chatId))) {
    return;
  }

  await notifyAdminsViaTelegram(
    `Messaggio Telegram da ${update.message?.from?.first_name ?? "utente"} (${chatId}): ${text.slice(0, 200)}`
  );
}
