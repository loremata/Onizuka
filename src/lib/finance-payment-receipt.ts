import { prisma } from "@/lib/prisma";
import { buildFinanceEntryPdfBuffer, financeEntryPdfFilename } from "@/lib/finance-entry-pdf";
import { isSmtpConfigured, sendEmailViaSmtp } from "@/lib/smtp-send";

/** Invia ricevuta PDF via SMTP agli utenti cliente collegati alla voce finance. */
export async function emailFinancePaymentReceipt(
  entryId: string
): Promise<{ ok: true } | { ok: false; error: string } | { ok: true; skipped: string }> {
  if (!isSmtpConfigured()) {
    return { ok: true, skipped: "SMTP non configurato" };
  }

  const entry = await prisma.financeEntry.findUnique({
    where: { id: entryId, type: "INCOME" },
    include: {
      client: { select: { companyName: true, vatNumber: true, contactEmail: true } },
      asset: { select: { name: true } },
    },
  });

  if (!entry?.clientId) {
    return { ok: false, error: "Voce finance o cliente non trovato." };
  }

  const clientUsers = await prisma.user.findMany({
    where: { clientId: entry.clientId, role: "CLIENT" },
    select: { email: true },
  });

  const recipients = Array.from(
    new Set(
      [
        entry.client?.contactEmail?.trim(),
        ...clientUsers.map((u) => u.email.trim()),
      ].filter(Boolean) as string[]
    )
  );

  if (recipients.length === 0) {
    return { ok: true, skipped: "Nessun email destinatario" };
  }

  const dateFmt = new Intl.DateTimeFormat("it-IT", { dateStyle: "long" });
  const amountEur = Number(entry.amountEur.toString()).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
  });

  const buffer = await buildFinanceEntryPdfBuffer({
    entryId: entry.id,
    label: entry.label,
    type: entry.type,
    status: entry.status,
    amountEur,
    clientName: entry.client?.companyName ?? null,
    clientVat: entry.client?.vatNumber ?? null,
    assetName: entry.asset?.name ?? null,
    invoiceNumber: entry.invoiceNumber,
    dueDate: entry.dueDate ? dateFmt.format(entry.dueDate) : null,
    paidAt: entry.paidAt ? dateFmt.format(entry.paidAt) : null,
    notes: entry.notes,
  });

  const filename = financeEntryPdfFilename(entry.label, entry.id);
  const subject = entry.invoiceNumber
    ? `Ricevuta pagamento · ${entry.invoiceNumber}`
    : `Ricevuta pagamento · ${entry.label}`;

  const text = [
    `Gentile cliente,`,
    ``,
    `Confermiamo la ricezione del pagamento di € ${amountEur} per: ${entry.label}.`,
    `In allegato la ricevuta PDF.`,
    ``,
    `Cordiali saluti,`,
    `Onizuka`,
  ].join("\n");

  for (const to of recipients) {
    const sent = await sendEmailViaSmtp({
      to,
      subject,
      text,
      html: `<p>${text.replace(/\n/g, "<br>")}</p>`,
      attachments: [{ filename, content: buffer, contentType: "application/pdf" }],
    });
    if (!sent.ok) return { ok: false, error: sent.error };
  }

  return { ok: true };
}
