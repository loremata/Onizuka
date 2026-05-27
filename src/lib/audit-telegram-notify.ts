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
}): Promise<void> {
  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://onizuka.it";
  const auditUrl = `${base}/admin/audit/digital/${params.auditId}`;

  const lines = [
    "Onizuka · Audit completato",
    "",
    `Cliente: ${params.businessName}`,
    `Score: ${params.overallScore}/100`,
    params.priorityProblem ? `Problema prioritario: ${params.priorityProblem}` : "",
    params.brandName && params.serviceName ? `Servizio consigliato: ${params.brandName} — ${params.serviceName}` : "",
    "",
    "Ho preparato:",
    params.internalReportDriveUrl ? `- report interno (Drive)` : "- report interno (PDF in app)",
    params.clientReportDriveUrl ? `- report cliente (Drive)` : "- report cliente (PDF in app)",
    params.outreachDraftId ? "- bozza email in attesa approvazione" : "",
    "",
    `Dettaglio: ${auditUrl}`,
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
        [{ text: "Vedi audit", callback_data: `av:${params.auditId}` }],
      ],
    };
  } else {
    keyboard = {
      inline_keyboard: [[{ text: "Vedi audit", callback_data: `av:${params.auditId}` }]],
    };
  }

  await notifyAdminsViaTelegram(lines.join("\n"), keyboard);
}
