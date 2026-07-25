import { NextResponse } from "next/server";
import {
  ingestWhatsAppWebhookPayload,
  verifyWhatsAppSignature,
} from "@/lib/whatsapp-webhook";
import { timingSafeStrEqual } from "@/lib/timing-safe-str";

/** Verifica webhook Meta WhatsApp + ricezione messaggi in ingresso. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

  if (mode === "subscribe" && expected && timingSafeStrEqual(token, expected) && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verifica fallita" }, { status: 403 });
}

export async function POST(request: Request) {
  // Fail-closed: se l'integrazione WhatsApp non è configurata (nessun App Secret,
  // quindi nessun modo di verificare l'autenticità dei messaggi), il webhook
  // inbound è DISATTIVATO. Rispondiamo 404 per non esporre un endpoint che
  // processa payload arbitrari. Appena si aggiunge WHATSAPP_APP_SECRET la
  // ricezione si attiva e pretende la firma valida.
  if (!process.env.WHATSAPP_APP_SECRET?.trim()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Leggiamo il RAW body PRIMA di fare JSON.parse: l'HMAC di Meta è calcolato
  // sul corpo grezzo esatto, quindi non possiamo ri-serializzare l'oggetto.
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  // Secret configurato → la firma è obbligatoria e deve combaciare, altrimenti 401.
  if (!verifyWhatsAppSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Firma non valida" }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    body = {};
  }

  const stored = await ingestWhatsAppWebhookPayload(body);
  return NextResponse.json({ ok: true, stored });
}
