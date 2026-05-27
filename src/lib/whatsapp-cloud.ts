/** Invio messaggio WhatsApp Cloud API (Meta). Richiede WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID. */
export function isWhatsAppConfigured(): boolean {
  return !!(process.env.WHATSAPP_ACCESS_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim());
}

export async function sendWhatsAppTextMessage(params: {
  toE164: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneId) {
    return { ok: false, error: "WhatsApp non configurato (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID)." };
  }

  const to = params.toE164.replace(/\D/g, "");
  if (to.length < 10) return { ok: false, error: "Numero destinatario non valido." };

  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: params.body.slice(0, 4096) },
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return { ok: false, error: `WhatsApp API ${res.status}: ${err.slice(0, 200)}` };
  }

  return { ok: true };
}

/** Messaggio template HSM (nome template approvato su Meta Business). */
export async function sendWhatsAppTemplateMessage(params: {
  toE164: string;
  templateName: string;
  languageCode?: string;
  bodyParameters?: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneId) {
    return { ok: false, error: "WhatsApp non configurato." };
  }

  const to = params.toE164.replace(/\D/g, "");
  const templateName = params.templateName.trim();
  if (!to || to.length < 10) return { ok: false, error: "Numero destinatario non valido." };
  if (!templateName) return { ok: false, error: "Nome template obbligatorio." };

  const components =
    params.bodyParameters && params.bodyParameters.length > 0
      ? [
          {
            type: "body",
            parameters: params.bodyParameters.map((text) => ({ type: "text", text: text.slice(0, 256) })),
          },
        ]
      : undefined;

  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: params.languageCode?.trim() || "it" },
        ...(components ? { components } : {}),
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return { ok: false, error: `WhatsApp template ${res.status}: ${err.slice(0, 200)}` };
  }

  return { ok: true };
}
