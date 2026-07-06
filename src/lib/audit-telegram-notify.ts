import { notifyAdminsViaTelegram, type TelegramInlineKeyboard } from "@/lib/telegram-bot";

export async function notifyDigitalAuditCompleted(params: {
  businessName: string;
  overallScore: number;
  priorityProblem: string | null;
  brandName: string | null;
  serviceName: string | null;
  auditId: string;
  outreachDraftId?: string;
  internalReportDriveUrl?: string | null;
  clientReportDriveUrl?: string | null;
  publicReportUrl?: string | null;
  draftSubject?: string | null;
  draftBody?: string | null;
  recipientEmail?: string | null;
}): Promise<void> {
  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://onizuka.it";
  const auditUrl = `${base}/admin/audit/digital/${params.auditId}`;

  const isPlaceholder = !params.recipientEmail || /@onizuka\.local$/i.test(params.recipientEmail);

  const lines = [
    "🔎 Onizuka · Audit completato",
    "",
    `Cliente: ${params.businessName}`,
    `Punteggio: ${params.overallScore}/100`,
    params.priorityProblem ? `Priorità: ${params.priorityProblem}` : "",
    params.brandName && params.serviceName ? `Consigliato: ${params.brandName} — ${params.serviceName}` : "",
    params.publicReportUrl ? `\n📄 Report (mostralo al cliente):\n${params.publicReportUrl}` : "",
    params.outreachDraftId ? "\n✉️ Bozza email da approvare" : "",
    params.draftSubject ? `Oggetto: ${params.draftSubject}` : "",
    params.outreachDraftId
      ? isPlaceholder
        ? "⚠️ Senza email valida → usa WhatsApp/telefono (Approva non invierà)"
        : `A: ${params.recipientEmail}`
      : "",
    params.outreachDraftId ? `👉 Leggi la bozza completa: ${base}/admin/reach?draft=${params.outreachDraftId}` : "",
    "",
    `Scheda audit: ${auditUrl}`,
  ].filter(Boolean);

  let keyboard: TelegramInlineKeyboard | undefined;
  if (params.outreachDraftId) {
    const draftId = params.outreachDraftId;
    keyboard = {
      inline_keyboard: [
        [
          { text: "Approva", callback_data: `oa:${draftId}` },
          { text: "Modifica", callback_data: `oe:${draftId}` },
          { text: "Rimanda", callback_data: `op:${draftId}` },
        ],
        [
          { text: "🛑 Stop follow-up", callback_data: `os:${draftId}` },
          { text: "Vedi audit", callback_data: `av:${params.auditId}` },
        ],
      ],
    };
  } else {
    keyboard = {
      inline_keyboard: [[{ text: "Vedi audit", callback_data: `av:${params.auditId}` }]],
    };
  }

  await notifyAdminsViaTelegram(lines.join("\n"), keyboard);
}
