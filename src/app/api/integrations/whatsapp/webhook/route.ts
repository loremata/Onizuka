import { NextResponse } from "next/server";
import { ingestWhatsAppWebhookPayload } from "@/lib/whatsapp-webhook";

/** Verifica webhook Meta WhatsApp + ricezione messaggi in ingresso. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verifica fallita" }, { status: 403 });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const stored = await ingestWhatsAppWebhookPayload(body);
  return NextResponse.json({ ok: true, stored });
}
