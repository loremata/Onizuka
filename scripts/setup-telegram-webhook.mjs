#!/usr/bin/env node
/**
 * Registra webhook Telegram su Onizuka.
 *   BASE_URL=https://onizuka.it TELEGRAM_BOT_TOKEN=… TELEGRAM_WEBHOOK_SECRET=… node scripts/setup-telegram-webhook.mjs
 */
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const base = (process.env.BASE_URL ?? process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

if (!token || !base) {
  console.error("Servono TELEGRAM_BOT_TOKEN e BASE_URL (o NEXTAUTH_URL)");
  process.exit(1);
}

const url = `${base}/api/integrations/telegram`;
// Includere callback_query: senza, i tap sui pulsanti inline (Approva/Modifica/…) non arrivano al webhook.
const body = { url, allowed_updates: ["message", "callback_query"] };
if (secret) body.secret_token = secret;

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const json = await res.json();
console.log(json);
process.exit(json.ok ? 0 : 1);
