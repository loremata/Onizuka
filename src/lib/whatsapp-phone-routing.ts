import { prisma } from "@/lib/prisma";

/** Risolve linea WhatsApp da phone_number_id webhook Meta. */
export async function resolveWhatsAppPhoneLine(phoneNumberId: string | null | undefined): Promise<{
  phoneLineId: string | null;
  phoneNumberId: string | null;
}> {
  const pid = phoneNumberId?.trim();
  if (!pid) {
    const def = await prisma.whatsAppPhoneLine.findFirst({
      where: { isDefault: true },
      select: { id: true, phoneNumberId: true },
    });
    if (def) return { phoneLineId: def.id, phoneNumberId: def.phoneNumberId };
    const envId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    return { phoneLineId: null, phoneNumberId: envId ?? null };
  }

  const line = await prisma.whatsAppPhoneLine.findUnique({
    where: { phoneNumberId: pid },
    select: { id: true, phoneNumberId: true },
  });
  if (line) return { phoneLineId: line.id, phoneNumberId: line.phoneNumberId };

  return { phoneLineId: null, phoneNumberId: pid };
}

/** Token e phone id per invio su linea specifica. */
export async function whatsAppSendContext(phoneLineId: string | null): Promise<{
  accessToken: string;
  phoneNumberId: string;
}> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN mancante.");

  if (phoneLineId) {
    const line = await prisma.whatsAppPhoneLine.findUnique({
      where: { id: phoneLineId },
      select: { phoneNumberId: true },
    });
    if (line) return { accessToken: token, phoneNumberId: line.phoneNumberId };
  }

  const def = await prisma.whatsAppPhoneLine.findFirst({
    where: { isDefault: true },
    select: { phoneNumberId: true },
  });
  const phoneId = def?.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!phoneId) throw new Error("Phone number ID non configurato.");
  return { accessToken: token, phoneNumberId: phoneId };
}
