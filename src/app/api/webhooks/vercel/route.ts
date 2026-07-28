import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { notifyAdminsViaTelegram } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";

/**
 * Avviso sui DEPLOY FALLITI.
 *
 * Il 28/07/2026 ogni deploy della giornata e' fallito in build e la produzione
 * ha continuato a servire il codice del giorno prima: test verdi, sito su, e
 * nessun segnale. Questo endpoint riceve gli eventi di deployment da Vercel e
 * manda un messaggio Telegram quando un rilascio non va a buon fine.
 *
 * Configurazione (una volta sola, dal pannello Vercel):
 *   Project → Settings → Webhooks → Create Webhook
 *   URL     : https://onizuka.it/api/webhooks/vercel
 *   Eventi  : deployment.error, deployment.succeeded, deployment.canceled
 *   Il segreto mostrato alla creazione va messo in VERCEL_WEBHOOK_SECRET.
 *
 * Sicurezza: firma HMAC-SHA1 sul corpo grezzo (header `x-vercel-signature`),
 * confronto timing-safe, FAIL-CLOSED — senza segreto configurato l'endpoint
 * rifiuta tutto invece di fidarsi.
 */

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha1", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

type VercelEvent = {
  type?: string;
  payload?: {
    target?: string | null;
    deployment?: { id?: string; url?: string; meta?: Record<string, string> };
    links?: { deployment?: string };
  };
};

export async function POST(request: NextRequest) {
  const secret = process.env.VERCEL_WEBHOOK_SECRET?.trim();
  if (!secret) {
    // Fail-closed: meglio nessun avviso che un endpoint che accetta chiunque.
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-vercel-signature"), secret)) {
    return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 401 });
  }

  let event: VercelEvent;
  try {
    event = JSON.parse(rawBody) as VercelEvent;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_payload" }, { status: 400 });
  }

  const type = event.type ?? "";
  const target = event.payload?.target ?? null;
  const meta = event.payload?.deployment?.meta ?? {};
  const sha = (meta.githubCommitSha ?? "").slice(0, 7);
  const message = (meta.githubCommitMessage ?? "").split("\n")[0].slice(0, 120);
  const link = event.payload?.links?.deployment ?? event.payload?.deployment?.url ?? "";

  // Solo la produzione: i preview falliti sono rumore.
  if (target !== "production") {
    return NextResponse.json({ ok: true, ignored: "not_production", type, target });
  }

  if (type === "deployment.error" || type === "deployment.canceled") {
    const verbo = type === "deployment.error" ? "FALLITO" : "annullato";
    await notifyAdminsViaTelegram(
      `🚨 *Deploy ${verbo}*\n\n` +
        `${sha ? `\`${sha}\` ` : ""}${message || "(nessun messaggio)"}\n\n` +
        `La produzione sta ancora servendo la versione precedente.\n` +
        (link ? `Log: ${link.startsWith("http") ? link : `https://${link}`}` : "")
    ).catch(() => undefined);
    return NextResponse.json({ ok: true, alerted: true, type });
  }

  return NextResponse.json({ ok: true, alerted: false, type });
}
