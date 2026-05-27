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
      }
    }
  }

  return stored;
}
