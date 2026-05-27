import { prisma } from "@/lib/prisma";

function waToken(): string | null {
  return process.env.WHATSAPP_ACCESS_TOKEN?.trim() || null;
}

function wabaId(): string | null {
  return (
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() ||
    process.env.WHATSAPP_WABA_ID?.trim() ||
    null
  );
}

export function isWhatsAppTemplateSyncConfigured(): boolean {
  return !!(waToken() && wabaId());
}

type MetaTemplate = {
  name: string;
  language: string;
  status: string;
  category?: string;
  components?: { type: string; text?: string }[];
};

/** Importa template approvati da Meta Business Manager nel catalogo locale. */
export async function syncWhatsAppTemplatesFromMeta(): Promise<{
  upserted: number;
  error?: string;
}> {
  const token = waToken();
  const waba = wabaId();
  if (!token || !waba) {
    return { upserted: 0, error: "WHATSAPP_ACCESS_TOKEN e WHATSAPP_BUSINESS_ACCOUNT_ID richiesti." };
  }

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${waba}/message_templates?limit=100&access_token=${encodeURIComponent(token)}`
  );
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return { upserted: 0, error: `Meta templates ${res.status}: ${err.slice(0, 200)}` };
  }

  const json = (await res.json()) as { data?: MetaTemplate[] };
  let upserted = 0;
  for (const t of json.data ?? []) {
    if (t.status !== "APPROVED") continue;
    const bodyComp = t.components?.find((c) => c.type === "BODY");
    const preview = bodyComp?.text?.slice(0, 500) ?? t.name;
    const lang = (t.language || "it").toLowerCase().slice(0, 5);
    await prisma.whatsAppTemplate.upsert({
      where: { name_languageCode: { name: t.name, languageCode: lang } },
      create: {
        name: t.name,
        languageCode: lang,
        bodyPreview: preview,
        category: t.category ?? null,
      },
      update: { bodyPreview: preview, category: t.category ?? null },
    });
    upserted += 1;
  }

  return { upserted };
}
