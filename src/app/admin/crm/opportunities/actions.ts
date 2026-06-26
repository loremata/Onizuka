"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { OpportunityPriority, OpportunityStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { logAuditEvent } from "@/lib/admin-audit-log";
import { prisma } from "@/lib/prisma";
import { notifyAdminUsers } from "@/lib/user-notifications";
import { opportunityPriorityOptions, opportunityStatusOptions } from "@/lib/crm-opportunity";
import { assertOpportunityParty } from "@/lib/opportunity-party";
import { propagateOpportunityWon } from "@/lib/opportunity-won-propagation";
import { propagateOpportunityLost } from "@/lib/opportunity-lost-propagation";

export type OpportunityActionResult = { error: string } | { ok: true } | null;

function optionalString(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s ? s : null;
}

function parseStatus(raw: string | null): OpportunityStatus | null {
  if (!raw) return null;
  return opportunityStatusOptions.includes(raw as OpportunityStatus) ? (raw as OpportunityStatus) : null;
}

function parsePriority(raw: string | null): OpportunityPriority | null {
  if (!raw) return null;
  return opportunityPriorityOptions.includes(raw as OpportunityPriority) ? (raw as OpportunityPriority) : null;
}

async function ensureAdmin() {
  const session = await requireAdminArea();
  return session;
}

async function commitOpportunityStatusChange(
  ownerUserId: string,
  opportunityId: string,
  status: OpportunityStatus
): Promise<OpportunityActionResult> {
  const existing = await prisma.opportunity.findFirst({
    where: { id: opportunityId, ownerUserId },
  });
  if (!existing) return { error: "Opportunità non trovata." };
  if (existing.status === status) return null;

  try {
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { status },
    });
    void logAuditEvent({
      actorUserId: ownerUserId,
      action: "opportunity.status",
      entityType: "opportunity",
      entityId: opportunityId,
      summary: `Opportunità «${existing.title}» → ${status}`,
    });

    if (status === "WON") {
      // Propagazione: promuove il cliente, attiva il servizio, converte il lead.
      await propagateOpportunityWon(opportunityId);
      void notifyAdminUsers({
        kind: "opportunity_won",
        title: `Opportunità vinta: ${existing.title}`,
        href: `/admin/crm/opportunities/${opportunityId}/edit`,
      }).catch(() => {});
    } else if (status === "LOST") {
      // Asse LOST: rimette il prospect in nurturing e crea il task di ri-proposta.
      await propagateOpportunityLost(opportunityId);
    }
  } catch (e) {
    console.error(e);
    return { error: "Aggiornamento stato non riuscito." };
  }

  revalidatePath("/admin/crm/pipeline");
  revalidatePath("/admin/audit");
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/crm/opportunities");
  revalidatePath("/admin");
  revalidatePath(`/admin/crm/opportunities/${opportunityId}/edit`);
  revalidatePath("/admin/search");
  if (existing.clientId) revalidatePath(`/admin/clients/${existing.clientId}`);
  if (existing.leadId) revalidatePath(`/admin/crm/leads/${existing.leadId}/edit`);
  return { ok: true } as const;
}

function parseEstimatedValue(raw: string | null): Prisma.Decimal | null {
  if (!raw?.trim()) return null;
  const n = Number(raw.replace(",", "."));
  if (Number.isNaN(n) || n < 0) return null;
  return new Prisma.Decimal(n.toFixed(2));
}

function parseProbability(raw: string | null): number | null {
  if (!raw?.trim()) return null;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return null;
  if (n < 0 || n > 100) return null;
  return n;
}

export async function createOpportunity(
  _prev: OpportunityActionResult,
  formData: FormData
): Promise<OpportunityActionResult> {
  const session = await ensureAdmin();

  const clientId = optionalString(formData.get("clientId"));
  const leadId = optionalString(formData.get("leadId"));
  const title = (formData.get("title") as string)?.trim();
  const description = optionalString(formData.get("description"));
  const assetId = optionalString(formData.get("assetId"));
  const status = parseStatus((formData.get("status") as string) ?? null) ?? "OPEN";
  const priority = parsePriority((formData.get("priority") as string) ?? null) ?? "MEDIUM";
  const estimatedValue = parseEstimatedValue((formData.get("estimatedValue") as string) ?? null);
  const probability = parseProbability((formData.get("probability") as string) ?? null);
  const nextAction = optionalString(formData.get("nextAction"));
  const dueRaw = (formData.get("dueDate") as string)?.trim();
  let dueDate: Date | undefined;
  if (dueRaw) {
    const d = new Date(dueRaw);
    if (Number.isNaN(d.getTime())) return { error: "Data scadenza non valida." };
    dueDate = d;
  }

  const partyError = assertOpportunityParty({ clientId, leadId });
  if (partyError) return { error: partyError };
  if (!title) return { error: "Il titolo è obbligatorio." };

  if (clientId) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return { error: "Cliente non trovato." };
  }
  if (leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, ownerUserId: session.user.id },
    });
    if (!lead) return { error: "Lead non trovato." };
  }

  if (assetId) {
    if (!clientId) return { error: "Gli asset richiedono un cliente collegato." };
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) return { error: "Asset non trovato." };
    if (asset.clientId !== clientId) return { error: "L'asset non appartiene al cliente selezionato." };
  }

  try {
    const opp = await prisma.opportunity.create({
      data: {
        clientId: clientId ?? null,
        leadId: leadId ?? null,
        title,
        description,
        assetId,
        status,
        priority,
        estimatedValue: estimatedValue ?? undefined,
        probability: probability ?? undefined,
        nextAction,
        dueDate,
        ownerUserId: session.user.id,
      },
    });
    void logAuditEvent({
      actorUserId: session.user.id,
      action: "opportunity.create",
      entityType: "opportunity",
      entityId: opp.id,
      summary: `Creata opportunità «${title}»`,
    });
  } catch (e) {
    console.error(e);
    return { error: "Creazione opportunità non riuscita." };
  }

  revalidatePath("/admin/crm/opportunities");
  revalidatePath("/admin/crm/pipeline");
  revalidatePath("/admin/search");
  revalidatePath("/admin");
  if (clientId) revalidatePath(`/admin/clients/${clientId}`);
  if (leadId) revalidatePath(`/admin/crm/leads/${leadId}/edit`);
  redirect("/admin/crm/opportunities");
}

export async function updateOpportunity(
  opportunityId: string,
  _prev: OpportunityActionResult,
  formData: FormData
): Promise<OpportunityActionResult> {
  const session = await ensureAdmin();

  const existing = await prisma.opportunity.findFirst({
    where: { id: opportunityId, ownerUserId: session.user.id },
  });
  if (!existing) return { error: "Opportunità non trovata." };

  const clientId = optionalString(formData.get("clientId"));
  const leadId = optionalString(formData.get("leadId"));
  const title = (formData.get("title") as string)?.trim();
  const description = optionalString(formData.get("description"));
  const assetId = optionalString(formData.get("assetId"));
  const status = parseStatus((formData.get("status") as string) ?? null) ?? "OPEN";
  const priority = parsePriority((formData.get("priority") as string) ?? null) ?? "MEDIUM";
  const estimatedValue = parseEstimatedValue((formData.get("estimatedValue") as string) ?? null);
  const probability = parseProbability((formData.get("probability") as string) ?? null);
  const nextAction = optionalString(formData.get("nextAction"));
  const dueRaw = (formData.get("dueDate") as string)?.trim();
  let dueDate: Date | null = null;
  if (dueRaw) {
    const d = new Date(dueRaw);
    if (Number.isNaN(d.getTime())) return { error: "Data scadenza non valida." };
    dueDate = d;
  }

  const partyError = assertOpportunityParty({ clientId, leadId });
  if (partyError) return { error: partyError };
  if (!title) return { error: "Il titolo è obbligatorio." };

  if (clientId) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return { error: "Cliente non trovato." };
  }
  if (leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, ownerUserId: session.user.id },
    });
    if (!lead) return { error: "Lead non trovato." };
  }

  if (assetId) {
    if (!clientId) return { error: "Gli asset richiedono un cliente collegato." };
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) return { error: "Asset non trovato." };
    if (asset.clientId !== clientId) return { error: "L'asset non appartiene al cliente selezionato." };
  }

  try {
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: {
        clientId: clientId ?? null,
        leadId: leadId ?? null,
        title,
        description,
        assetId,
        status,
        priority,
        estimatedValue,
        probability,
        nextAction,
        dueDate,
      },
    });
    void logAuditEvent({
      actorUserId: session.user.id,
      action: "opportunity.update",
      entityType: "opportunity",
      entityId: opportunityId,
      summary: `Aggiornata opportunità «${title}»`,
    });
  } catch (e) {
    console.error(e);
    return { error: "Aggiornamento opportunità non riuscito." };
  }

  revalidatePath("/admin/crm/opportunities");
  revalidatePath("/admin/audit");
  revalidatePath(`/admin/crm/opportunities/${opportunityId}/edit`);
  revalidatePath("/admin/crm/pipeline");
  revalidatePath("/admin/search");
  revalidatePath("/admin");
  if (existing.clientId && existing.clientId !== clientId) {
    revalidatePath(`/admin/clients/${existing.clientId}`);
  }
  if (clientId) revalidatePath(`/admin/clients/${clientId}`);
  if (leadId) revalidatePath(`/admin/crm/leads/${leadId}/edit`);
  if (existing.leadId && existing.leadId !== leadId) {
    revalidatePath(`/admin/crm/leads/${existing.leadId}/edit`);
  }
  redirect("/admin/crm/opportunities");
}

/** Aggiorna solo lo stato (es. dalla pipeline) senza redirect. */
export async function updateOpportunityStatus(
  opportunityId: string,
  _prev: OpportunityActionResult,
  formData: FormData
): Promise<OpportunityActionResult> {
  const session = await ensureAdmin();

  const status = parseStatus((formData.get("status") as string) ?? null);
  if (!status) return { error: "Stato non valido." };

  return commitOpportunityStatusChange(session.user.id, opportunityId, status);
}

/** Sposta opportunità in un altro stato (drag-and-drop sulla pipeline). */
export async function moveOpportunityToStatus(
  opportunityId: string,
  nextStatus: OpportunityStatus
): Promise<OpportunityActionResult> {
  const session = await ensureAdmin();
  return commitOpportunityStatusChange(session.user.id, opportunityId, nextStatus);
}

export async function deleteOpportunity(
  _prev: OpportunityActionResult,
  formData: FormData
): Promise<OpportunityActionResult> {
  const session = await ensureAdmin();

  const id = (formData.get("id") as string)?.trim();
  if (!id) return { error: "ID mancante." };

  const existing = await prisma.opportunity.findFirst({
    where: { id, ownerUserId: session.user.id },
  });
  if (!existing) return { error: "Opportunità non trovata." };

  try {
    await prisma.opportunity.delete({ where: { id } });
    void logAuditEvent({
      actorUserId: session.user.id,
      action: "opportunity.delete",
      entityType: "opportunity",
      entityId: id,
      summary: `Eliminata opportunità «${existing.title}»`,
    });
  } catch (e) {
    console.error(e);
    return { error: "Eliminazione non riuscita." };
  }

  revalidatePath("/admin/crm/opportunities");
  revalidatePath("/admin/audit");
  revalidatePath("/admin/crm/pipeline");
  revalidatePath("/admin/search");
  revalidatePath("/admin");
  revalidatePath(`/admin/clients/${existing.clientId}`);
  redirect("/admin/crm/opportunities");
}
