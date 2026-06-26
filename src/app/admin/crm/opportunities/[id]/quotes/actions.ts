"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-audit-log";
import { notifyClientUsers } from "@/lib/user-notifications";
import { parseQuoteLinesJson } from "@/lib/quote-lines";
import {
  clearQuoteNoResponseReminder,
  scheduleQuoteNoResponseReminder,
} from "@/lib/quote-no-response";
import { propagateOpportunityWon } from "@/lib/opportunity-won-propagation";
import { propagateOpportunityLost } from "@/lib/opportunity-lost-propagation";
import type { QuoteStatus } from "@prisma/client";

type ActionResult = { error: string } | null;

async function requireAdmin() {
  const session = await requireAdminArea();
  return session;
}

type QuoteFormOk = {
  title: string;
  linesJson: string;
  taxPercent: number;
  notes: string | null;
  validUntil: Date | null;
};

function readQuoteForm(formData: FormData): { error: string } | QuoteFormOk {
  const title = (formData.get("title") as string)?.trim() || "Preventivo";
  const linesJson = (formData.get("linesJson") as string)?.trim() ?? "[]";
  const taxPercent = Number(formData.get("taxPercent") ?? "22");
  const notes = (formData.get("notes") as string)?.trim() || null;
  const validUntilRaw = (formData.get("validUntil") as string)?.trim();
  const validUntil = validUntilRaw ? new Date(validUntilRaw) : null;

  const lines = parseQuoteLinesJson(linesJson);
  if (lines.length === 0) return { error: "Aggiungi almeno una riga al preventivo." };

  if (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100) {
    return { error: "IVA non valida." };
  }

  if (validUntilRaw && validUntil && isNaN(validUntil.getTime())) {
    return { error: "Data validità non valida." };
  }

  return { title, linesJson, taxPercent: Math.round(taxPercent), notes, validUntil };
}

export async function createOpportunityQuote(
  opportunityId: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireAdmin();
  const opp = await prisma.opportunity.findFirst({
    where: { id: opportunityId, ownerUserId: session.user.id },
  });
  if (!opp) return { error: "Opportunità non trovata." };

  const parsed = readQuoteForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const quote = await prisma.opportunityQuote.create({
    data: {
      opportunityId,
      ownerUserId: session.user.id,
      title: parsed.title,
      linesJson: parsed.linesJson,
      taxPercent: parsed.taxPercent,
      notes: parsed.notes,
      validUntil: parsed.validUntil,
    },
  });

  void logAdminAction({
    actorUserId: session.user.id,
    action: "quote.create",
    entityType: "quote",
    entityId: quote.id,
    summary: `Creato preventivo «${parsed.title}»`,
    metadata: { opportunityId },
  });

  redirect(`/admin/crm/opportunities/${opportunityId}/quotes/${quote.id}`);
}

export async function updateOpportunityQuote(
  opportunityId: string,
  quoteId: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireAdmin();
  const existing = await prisma.opportunityQuote.findFirst({
    where: { id: quoteId, opportunityId, ownerUserId: session.user.id },
  });
  if (!existing) return { error: "Preventivo non trovato." };

  const parsed = readQuoteForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  await prisma.opportunityQuote.update({
    where: { id: quoteId },
    data: {
      title: parsed.title,
      linesJson: parsed.linesJson,
      taxPercent: parsed.taxPercent,
      notes: parsed.notes,
      validUntil: parsed.validUntil,
    },
  });

  void logAdminAction({
    actorUserId: session.user.id,
    action: "quote.update",
    entityType: "quote",
    entityId: quoteId,
    summary: `Modificato preventivo «${parsed.title}»`,
    metadata: { opportunityId },
  });

  revalidatePath(`/admin/crm/opportunities/${opportunityId}/quotes/${quoteId}`);
  revalidatePath(`/admin/crm/opportunities/${opportunityId}/quotes`);
  redirect(`/admin/crm/opportunities/${opportunityId}/quotes/${quoteId}`);
}

export async function updateQuoteStatus(quoteId: string, status: QuoteStatus): Promise<ActionResult> {
  const session = await requireAdmin();
  const sentAt = status === "SENT" ? new Date() : undefined;
  const updated = await prisma.opportunityQuote.updateMany({
    where: { id: quoteId, ownerUserId: session.user.id },
    data: {
      status,
      ...(sentAt ? { sentAt } : {}),
      ...(status === "ACCEPTED" || status === "REJECTED" ? { noResponseDueAt: null } : {}),
    },
  });
  if (updated.count === 0) return { error: "Preventivo non trovato." };

  if (status === "SENT") {
    await scheduleQuoteNoResponseReminder(quoteId).catch(() => undefined);
  } else if (status === "ACCEPTED" || status === "REJECTED") {
    await clearQuoteNoResponseReminder(quoteId).catch(() => undefined);
  }

  const quote = await prisma.opportunityQuote.findUnique({
    where: { id: quoteId },
    include: { opportunity: { select: { id: true, clientId: true, title: true, status: true } } },
  });
  if (quote) {
    void logAdminAction({
      actorUserId: session.user.id,
      action: "quote.status",
      entityType: "quote",
      entityId: quoteId,
      summary: `Stato preventivo «${quote.title}» → ${status}`,
      metadata: { opportunityId: quote.opportunityId },
    });
    if (status === "ACCEPTED") {
      // Preventivo accettato = opportunità vinta → vince e propaga (cliente, servizio, lead).
      if (quote.opportunity.status !== "WON" && quote.opportunity.status !== "LOST") {
        await prisma.opportunity.update({ where: { id: quote.opportunity.id }, data: { status: "WON" } });
      }
      await propagateOpportunityWon(quote.opportunity.id);
      if (quote.opportunity.clientId) {
        void notifyClientUsers({
          clientId: quote.opportunity.clientId,
          kind: "quote_accepted",
          title: `Preventivo accettato · ${quote.title}`,
          body: `Opportunità: ${quote.opportunity.title}`,
          href: "/app",
        }).catch(() => {});
      }
      revalidatePath("/admin/crm/opportunities");
      if (quote.opportunity.clientId) revalidatePath(`/admin/clients/${quote.opportunity.clientId}`);
    } else if (status === "REJECTED") {
      // Rifiuto = opportunità persa → chiude e rimette il prospect in nurturing.
      if (quote.opportunity.status !== "WON" && quote.opportunity.status !== "LOST") {
        await prisma.opportunity.update({ where: { id: quote.opportunity.id }, data: { status: "LOST" } });
      }
      await propagateOpportunityLost(quote.opportunity.id, "preventivo rifiutato");
      revalidatePath("/admin/crm/opportunities");
      if (quote.opportunity.clientId) revalidatePath(`/admin/clients/${quote.opportunity.clientId}`);
    }
    revalidatePath(`/admin/crm/opportunities/${quote.opportunityId}/quotes/${quoteId}`);
    revalidatePath("/admin/audit");
  }
  return null;
}
