import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-audit-log";
import { notifyClientUsers } from "@/lib/user-notifications";
import { loadQuotePdfForOwner } from "@/lib/quote-pdf-load";
import { isSmtpConfigured, sendEmailViaSmtp } from "@/lib/smtp-send";
import { computeQuoteTotals, formatEur, parseQuoteLinesJson } from "@/lib/quote-lines";

export function quoteEmailEnabled(): boolean {
  if (process.env.QUOTE_NOTIFY_EMAIL === "0") return false;
  return isSmtpConfigured();
}

export function buildQuoteEmailText(params: {
  title: string;
  clientName: string;
  linesJson: string;
  taxPercent: number;
  notes: string | null;
  viewUrl: string;
  hasPdfAttachment: boolean;
}): string {
  const lines = parseQuoteLinesJson(params.linesJson);
  const totals = computeQuoteTotals(lines, params.taxPercent);
  const rows = lines.map(
    (l) => `  · ${l.description} — ${l.quantity} × ${formatEur(l.unitPrice)} = ${formatEur(l.quantity * l.unitPrice)}`
  );

  return [
    `Gentile ${params.clientName},`,
    ``,
    params.hasPdfAttachment
      ? `In allegato il PDF del preventivo «${params.title}».`
      : `Di seguito il riepilogo del preventivo «${params.title}».`,
    ``,
    ...rows,
    ``,
    `Imponibile: ${formatEur(totals.subtotal)}`,
    `IVA (${params.taxPercent}%): ${formatEur(totals.tax)}`,
    `Totale: ${formatEur(totals.total)}`,
    params.notes?.trim() ? `\nNote:\n${params.notes.trim()}` : "",
    ``,
    `Visualizza online: ${params.viewUrl}`,
    ``,
    `— Online Station`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendQuoteEmail(quoteId: string, ownerUserId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!quoteEmailEnabled()) {
    return { ok: false, error: "SMTP non configurato o invio disabilitato (QUOTE_NOTIFY_EMAIL)." };
  }

  const quote = await prisma.opportunityQuote.findFirst({
    where: { id: quoteId, ownerUserId },
    include: {
      opportunity: {
        include: {
          client: { select: { id: true, companyName: true, contactEmail: true } },
          lead: { select: { id: true, businessName: true, title: true, email: true } },
        },
      },
    },
  });

  if (!quote) return { ok: false, error: "Preventivo non trovato." };

  const client = quote.opportunity.client;
  const lead = quote.opportunity.lead;
  const partyName =
    client?.companyName ?? lead?.businessName ?? lead?.title ?? null;
  if (!partyName) {
    return { ok: false, error: "Collegare un cliente o un lead all'opportunità prima di inviare il preventivo." };
  }

  const to = client?.contactEmail?.trim() || lead?.email?.trim();
  if (!to) {
    return {
      ok: false,
      error: client
        ? "Email cliente mancante in anagrafica."
        : "Email lead mancante: completare contatto prospect prima dell'invio.",
    };
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const viewUrl = `${baseUrl}/admin/crm/opportunities/${quote.opportunityId}/quotes/${quote.id}`;

  const pdf = await loadQuotePdfForOwner(quoteId, ownerUserId);
  const hasPdf = pdf.ok;

  const text = buildQuoteEmailText({
    title: quote.title,
    clientName: partyName,
    linesJson: quote.linesJson,
    taxPercent: quote.taxPercent,
    notes: quote.notes,
    viewUrl,
    hasPdfAttachment: hasPdf,
  });

  const sent = await sendEmailViaSmtp({
    to,
    subject: `[Online Station] Preventivo: ${quote.title}`,
    text,
    attachments: hasPdf
      ? [{ filename: pdf.filename, content: pdf.buffer, contentType: "application/pdf" }]
      : undefined,
  });

  if (!sent.ok) return { ok: false, error: sent.error };

  const newStatus = quote.status === "DRAFT" ? "SENT" : quote.status;
  await prisma.opportunityQuote.update({
    where: { id: quoteId },
    data: { status: newStatus, sentAt: newStatus === "SENT" ? new Date() : quote.sentAt },
  });

  if (newStatus === "SENT") {
    const { scheduleQuoteNoResponseReminder } = await import("@/lib/quote-no-response");
    await scheduleQuoteNoResponseReminder(quoteId).catch(() => undefined);
  }

  await logAdminAction({
    actorUserId: ownerUserId,
    action: "quote.send_email",
    entityType: "quote",
    entityId: quoteId,
    summary: `Inviato preventivo «${quote.title}» a ${to}`,
    metadata: { opportunityId: quote.opportunityId, hasPdf },
  });

  if (client) {
    void notifyClientUsers({
      clientId: client.id,
      kind: "quote_sent",
      title: `Preventivo inviato · ${quote.title}`,
      body: "Controlla la tua email o contattaci per dettagli.",
      href: "/app",
    }).catch(() => {});
  }

  return { ok: true };
}
