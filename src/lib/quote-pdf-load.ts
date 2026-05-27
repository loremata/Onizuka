import { prisma } from "@/lib/prisma";
import { buildQuotePdfBuffer, quotePdfFilename, type QuotePdfInput } from "@/lib/quote-pdf";

const statusLabel: Record<string, string> = {
  DRAFT: "Bozza",
  SENT: "Inviato",
  ACCEPTED: "Accettato",
  REJECTED: "Rifiutato",
};

export async function loadQuotePdfForOwner(
  quoteId: string,
  ownerUserId: string
): Promise<
  | { ok: true; buffer: Buffer; filename: string }
  | { ok: false; error: "not_found" }
> {
  const quote = await prisma.opportunityQuote.findFirst({
    where: { id: quoteId, ownerUserId },
    include: {
      opportunity: {
        include: {
          client: { select: { companyName: true, vatNumber: true } },
          lead: { select: { businessName: true, title: true } },
        },
      },
    },
  });

  if (!quote) return { ok: false, error: "not_found" };

  const input: QuotePdfInput = {
    quoteId: quote.id,
    title: quote.title,
    clientName:
      quote.opportunity.client?.companyName ??
      quote.opportunity.lead?.businessName ??
      quote.opportunity.lead?.title ??
      "Prospect",
    vatNumber: quote.opportunity.client?.vatNumber ?? null,
    opportunityTitle: quote.opportunity.title,
    statusLabel: statusLabel[quote.status] ?? quote.status,
    linesJson: quote.linesJson,
    taxPercent: quote.taxPercent,
    notes: quote.notes,
    validUntil: quote.validUntil,
  };

  const buffer = await buildQuotePdfBuffer(input);
  return { ok: true, buffer, filename: quotePdfFilename(quote.title, quote.id) };
}
