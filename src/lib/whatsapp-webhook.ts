import { createHmac, timingSafeEqual } from "node:crypto";
import { runWhatsAppInboundAutomationRules } from "@/lib/automation-rules-run";
import { resolveWhatsAppPhoneLine } from "@/lib/whatsapp-phone-routing";
import { prisma } from "@/lib/prisma";

type MetaWebhookBody = {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: {
          id?: string;
          from?: string;
          type?: string;
          text?: { body?: string };
        }[];
      };
    }[];
  }[];
};

/**
 * Verifica la firma Meta `X-Hub-Signature-256: sha256=<hmac>` sul RAW body.
 * Meta calcola l'HMAC-SHA256 del corpo grezzo con l'App Secret.
 *
 * Fail-closed: senza `WHATSAPP_APP_SECRET` non c'è modo di autenticare il
 * messaggio → ritorna `false` (il chiamante DEVE rifiutare). Ritorna `true`
 * solo se la firma è presente e combacia.
 */
export function verifyWhatsAppSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();

  // Nessun secret → non possiamo verificare nulla: rifiutiamo (fail-closed).
  if (!appSecret) return false;

  // Da qui in poi il secret c'è → la firma è obbligatoria e deve combaciare.
  if (!signatureHeader) return false;

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  // L'header ha forma "sha256=<hex>": normalizziamo togliendo il prefisso se presente.
  const provided = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;

  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");
  // timingSafeEqual richiede buffer di ugual lunghezza: scarto subito le lunghezze diverse.
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

export async function ingestWhatsAppWebhookPayload(body: unknown): Promise<number> {
  const payload = body as MetaWebhookBody;
  let stored = 0;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const phoneNumberId = change.value?.metadata?.phone_number_id?.trim() ?? null;
      const line = await resolveWhatsAppPhoneLine(phoneNumberId);

      for (const msg of change.value?.messages ?? []) {
        const phoneFrom = msg.from?.trim();
        if (!phoneFrom) continue;
        const bodyText = msg.text?.body?.trim() ?? null;
        const waMessageId = msg.id?.trim() || null;

        if (waMessageId) {
          const exists = await prisma.whatsAppInboundMessage.findUnique({
            where: { waMessageId },
            select: { id: true },
          });
          if (exists) continue;
        }

        const created = await prisma.whatsAppInboundMessage.create({
          data: {
            waMessageId,
            phoneFrom,
            body: bodyText,
            phoneLineId: line.phoneLineId,
            phoneNumberId: line.phoneNumberId,
            rawJson: JSON.stringify(msg).slice(0, 8000),
          },
        });
        stored += 1;
        void runWhatsAppInboundAutomationRules({
          messageId: created.id,
          phoneFrom,
          body: bodyText,
        }).catch(() => {});
        // Il lead ha risposto via WhatsApp → ferma le sue sequenze di follow-up.
        void import("@/lib/outreach-sequence-stop")
          .then((m) => m.stopSequencesByInboundPhone(phoneFrom))
          .catch(() => {});
      }
    }
  }

  return stored;
}
