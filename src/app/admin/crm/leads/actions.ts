"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { ClientStatus, LeadStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { leadStatusOptions } from "@/lib/crm-lead-status";
import { clientStatusOptions } from "@/lib/crm-client-status";
import { logAuditEvent } from "@/lib/admin-audit-log";
import { notifyAdminUsers } from "@/lib/user-notifications";
import { slugify } from "@/lib/slug";
import { assertFiscalIdentityUnique, assertLeadVatClientLink } from "@/lib/client-fiscal-identity";
import { formatFiscalUniqueViolation } from "@/lib/fiscal-unique-error";
import { inferClientKind } from "@/lib/client-kind";
import { normalizeFiscalCode, normalizeFiscalIdentity, normalizeVatNumber } from "@/lib/fiscal-normalize";
import { runLeadCreatedAutomationRules } from "@/lib/automation-rules-run";

export type LeadActionResult = { error: string } | { ok: true } | null;

function optionalString(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s ? s : null;
}

function parseLeadStatus(raw: string | null): LeadStatus | null {
  if (!raw) return null;
  return leadStatusOptions.includes(raw as LeadStatus) ? (raw as LeadStatus) : null;
}

function parseClientStatus(raw: string | null): ClientStatus | null {
  if (!raw) return null;
  return clientStatusOptions.includes(raw as ClientStatus) ? (raw as ClientStatus) : null;
}

async function ensureAdmin() {
  const session = await requireAdminArea();
  return session;
}

export async function createLead(_prev: LeadActionResult, formData: FormData): Promise<LeadActionResult> {
  const session = await ensureAdmin();

  const title = (formData.get("title") as string)?.trim();
  const contactName = optionalString(formData.get("contactName"));
  const businessName = optionalString(formData.get("businessName"));
  const email = optionalString(formData.get("email"));
  const phone = optionalString(formData.get("phone"));
  const { vatNumber, fiscalCode } = normalizeFiscalIdentity({
    vatNumber: optionalString(formData.get("vatNumber")),
    fiscalCode: optionalString(formData.get("fiscalCode")),
  });
  const source = optionalString(formData.get("source"));
  const referrerId = optionalString(formData.get("referrerId"));
  const status = parseLeadStatus((formData.get("status") as string) ?? null) ?? "NEW";
  const notes = optionalString(formData.get("notes"));
  const convertedClientId = optionalString(formData.get("convertedClientId"));

  if (!title) return { error: "Il titolo è obbligatorio." };

  if (convertedClientId) {
    const c = await prisma.client.findUnique({ where: { id: convertedClientId } });
    if (!c) return { error: "Cliente collegato non trovato." };
    const taken = await prisma.lead.findFirst({ where: { convertedClientId } });
    if (taken) return { error: "Questo cliente è già collegato a un altro lead convertito." };
    const vatLink = await assertLeadVatClientLink({ vatNumber, convertedClientId });
    if (vatLink) return { error: vatLink.error };
  }

  try {
    const lead = await prisma.lead.create({
      data: {
        title,
        contactName,
        businessName,
        email,
        phone,
        vatNumber,
        fiscalCode,
        source: source ?? (referrerId ? "referral" : null),
        referrerId,
        status,
        notes,
        ownerUserId: session.user.id,
        convertedClientId,
      },
    });
    void logAuditEvent({
      actorUserId: session.user.id,
      action: "lead.create",
      entityType: "lead",
      entityId: lead.id,
      summary: `Creato lead «${title}»`,
    });
    void notifyAdminUsers({
      kind: "lead_new",
      title: `Nuovo lead: ${title}`,
      href: `/admin/crm/leads/${lead.id}/edit`,
    }).catch(() => {});
    void runLeadCreatedAutomationRules(session.user.id, lead.id, lead.title);
  } catch (e) {
    console.error(e);
    return { error: "Creazione lead non riuscita." };
  }

  revalidatePath("/admin/crm/leads");
  revalidatePath("/admin/search");
  revalidatePath("/admin/audit");
  revalidatePath("/admin/notifications");
  revalidatePath("/admin");
  if (convertedClientId) revalidatePath(`/admin/clients/${convertedClientId}`);
  redirect("/admin/crm/leads");
}

export async function updateLead(
  leadId: string,
  _prev: LeadActionResult,
  formData: FormData
): Promise<LeadActionResult> {
  const session = await ensureAdmin();

  const existing = await prisma.lead.findFirst({
    where: { id: leadId, ownerUserId: session.user.id },
  });
  if (!existing) return { error: "Lead non trovato." };

  const title = (formData.get("title") as string)?.trim();
  const contactName = optionalString(formData.get("contactName"));
  const businessName = optionalString(formData.get("businessName"));
  const email = optionalString(formData.get("email"));
  const phone = optionalString(formData.get("phone"));
  const { vatNumber, fiscalCode } = normalizeFiscalIdentity({
    vatNumber: optionalString(formData.get("vatNumber")),
    fiscalCode: optionalString(formData.get("fiscalCode")),
  });
  const source = optionalString(formData.get("source"));
  const referrerId = optionalString(formData.get("referrerId"));
  const status = parseLeadStatus((formData.get("status") as string) ?? null) ?? "NEW";
  const notes = optionalString(formData.get("notes"));
  const convertedClientId = optionalString(formData.get("convertedClientId"));

  if (!title) return { error: "Il titolo è obbligatorio." };

  if (convertedClientId) {
    const c = await prisma.client.findUnique({ where: { id: convertedClientId } });
    if (!c) return { error: "Cliente collegato non trovato." };
    const taken = await prisma.lead.findFirst({
      where: { convertedClientId, id: { not: leadId } },
    });
    if (taken) return { error: "Questo cliente è già collegato a un altro lead convertito." };
    const vatLink = await assertLeadVatClientLink({ vatNumber, convertedClientId });
    if (vatLink) return { error: vatLink.error };
  }

  try {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        title,
        contactName,
        businessName,
        email,
        phone,
        vatNumber,
        fiscalCode,
        source: source ?? (referrerId ? "referral" : null),
        referrerId,
        status,
        notes,
        convertedClientId,
      },
    });
    void logAuditEvent({
      actorUserId: session.user.id,
      action: "lead.update",
      entityType: "lead",
      entityId: leadId,
      summary: `Aggiornato lead «${title}»`,
    });
  } catch (e) {
    console.error(e);
    return { error: "Aggiornamento lead non riuscito." };
  }

  revalidatePath("/admin/crm/leads");
  revalidatePath("/admin/audit");
  revalidatePath(`/admin/crm/leads/${leadId}/edit`);
  revalidatePath("/admin/search");
  revalidatePath("/admin");
  if (existing.convertedClientId) revalidatePath(`/admin/clients/${existing.convertedClientId}`);
  if (convertedClientId) revalidatePath(`/admin/clients/${convertedClientId}`);
  redirect("/admin/crm/leads");
}

export async function convertLeadToClient(
  leadId: string,
  _prev: LeadActionResult,
  formData: FormData
): Promise<LeadActionResult> {
  const session = await ensureAdmin();

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, ownerUserId: session.user.id },
  });
  if (!lead) return { error: "Lead non trovato." };
  if (lead.convertedClientId) {
    return { error: "Questo lead risulta già convertito in cliente." };
  }

  const companyName = (formData.get("companyName") as string)?.trim();
  const slugInput = (formData.get("slug") as string)?.trim();
  const contactEmail = (formData.get("contactEmail") as string)?.trim();
  const status = parseClientStatus((formData.get("status") as string) ?? null) ?? "ACTIVE_CLIENT";
  const notesExtra = optionalString(formData.get("notes"));
  const vatNumber = normalizeVatNumber(optionalString(formData.get("vatNumber")) ?? lead.vatNumber);
  const fiscalCode = normalizeFiscalCode(optionalString(formData.get("fiscalCode")) ?? lead.fiscalCode);
  const kind = inferClientKind({ vatNumber, fiscalCode });
  const phone = optionalString(formData.get("phone"));
  const website = optionalString(formData.get("website"));
  const address = optionalString(formData.get("address"));
  const city = optionalString(formData.get("city"));
  const countryRaw = optionalString(formData.get("country"));
  const country = countryRaw ?? "IT";

  if (!companyName) return { error: "La ragione sociale è obbligatoria." };
  if (!contactEmail) return { error: "L'email di contatto è obbligatoria per creare il cliente." };

  const fiscalConflict = await assertFiscalIdentityUnique({ vatNumber, fiscalCode });
  if (fiscalConflict) {
    return {
      error: `${fiscalConflict.error} Scheda esistente: /admin/clients/${fiscalConflict.existingClientId}`,
    };
  }

  const slug = slugInput ? slugify(slugInput) : slugify(companyName);
  if (!slug) return { error: "Impossibile generare lo slug; usa lettere o numeri." };

  let finalSlug = slug;
  let attempt = 0;
  while (true) {
    const existing = await prisma.client.findUnique({ where: { slug: finalSlug } });
    if (!existing) break;
    attempt++;
    finalSlug = `${slug}-${attempt}`;
  }

  const leadRef = `Convertito da lead: «${lead.title}»${lead.contactName ? ` — contatto: ${lead.contactName}` : ""}`;
  const mergedNotes = [leadRef, lead.notes?.trim(), notesExtra].filter(Boolean).join("\n\n");

  try {
    const newClient = await prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          companyName,
          slug: finalSlug,
          contactEmail,
          status,
          notes: mergedNotes || null,
          vatNumber,
          fiscalCode,
          kind,
          clientMacroCategory: lead.clientMacroCategory,
          phone,
          website,
          address,
          city,
          country,
        },
      });
      await tx.lead.update({
        where: { id: leadId },
        data: {
          status: "CONVERTED",
          convertedClientId: client.id,
        },
      });
      await tx.opportunity.updateMany({
        where: { leadId },
        data: { clientId: client.id },
      });
      return client;
    });

    revalidatePath("/admin/clients");
    revalidatePath("/admin/crm/leads");
    revalidatePath(`/admin/crm/leads/${leadId}/edit`);
    revalidatePath(`/admin/crm/leads/${leadId}/convert`);
    revalidatePath("/admin/search");
    revalidatePath("/admin");
    revalidatePath(`/admin/clients/${newClient.id}`);
    void logAuditEvent({
      actorUserId: session.user.id,
      action: "lead.convert",
      entityType: "lead",
      entityId: leadId,
      summary: `Lead «${lead.title}» convertito in «${newClient.companyName}»`,
      metadata: { clientId: newClient.id },
    });
    revalidatePath("/admin/audit");
    redirect(`/admin/clients/${newClient.id}`);
  } catch (e) {
    const fiscal = formatFiscalUniqueViolation(e);
    if (fiscal) return { error: fiscal };
    console.error(e);
    return { error: "Conversione non riuscita. Verifica slug/email univoci." };
  }
}

export async function deleteLead(_prev: LeadActionResult, formData: FormData): Promise<LeadActionResult> {
  const session = await ensureAdmin();
  const id = (formData.get("id") as string)?.trim();
  if (!id) return { error: "ID mancante." };

  const existing = await prisma.lead.findFirst({
    where: { id, ownerUserId: session.user.id },
  });
  if (!existing) return { error: "Lead non trovato." };

  try {
    await prisma.lead.delete({ where: { id } });
    void logAuditEvent({
      actorUserId: session.user.id,
      action: "lead.delete",
      entityType: "lead",
      entityId: id,
      summary: `Eliminato lead «${existing.title}»`,
    });
  } catch (e) {
    console.error(e);
    return { error: "Eliminazione non riuscita." };
  }

  revalidatePath("/admin/crm/leads");
  revalidatePath("/admin/audit");
  revalidatePath("/admin/search");
  revalidatePath("/admin");
  revalidatePath("/admin/clients");
  if (existing.convertedClientId) revalidatePath(`/admin/clients/${existing.convertedClientId}`);
  redirect("/admin/crm/leads");
}

/** Aggiorna solo lo stato (es. dalla tabella lead) senza redirect. */
export async function updateLeadStatus(
  leadId: string,
  _prev: LeadActionResult,
  formData: FormData
): Promise<LeadActionResult> {
  const session = await ensureAdmin();

  const status = parseLeadStatus((formData.get("status") as string) ?? null);
  if (!status) return { error: "Stato non valido." };

  const existing = await prisma.lead.findFirst({
    where: { id: leadId, ownerUserId: session.user.id },
  });
  if (!existing) return { error: "Lead non trovato." };
  if (existing.status === status) return null;

  try {
    await prisma.lead.update({
      where: { id: leadId },
      data: { status },
    });
  } catch (e) {
    console.error(e);
    return { error: "Aggiornamento stato non riuscito." };
  }

  revalidatePath("/admin/crm/leads");
  revalidatePath(`/admin/crm/leads/${leadId}/edit`);
  revalidatePath("/admin/search");
  revalidatePath("/admin");
  if (existing.convertedClientId) revalidatePath(`/admin/clients/${existing.convertedClientId}`);
  return { ok: true } as const;
}

/** Front-office quick capture: pochi campi, titolo auto da businessName. */
export async function createQuickLead(
  _prev: LeadActionResult,
  formData: FormData
): Promise<LeadActionResult> {
  const businessName = optionalString(formData.get("businessName"));
  const contactName = optionalString(formData.get("contactName"));
  const phone = optionalString(formData.get("phone"));
  if (!businessName && !contactName) {
    return { error: "Inserisci almeno ragione sociale o nome contatto." };
  }
  const title = businessName ?? contactName ?? "Lead banco";
  const fd = new FormData();
  fd.set("title", title);
  if (contactName) fd.set("contactName", contactName);
  if (businessName) fd.set("businessName", businessName);
  if (phone) fd.set("phone", phone);
  const email = optionalString(formData.get("email"));
  if (email) fd.set("email", email);
  fd.set("source", "banco");
  fd.set("status", "NEW");
  const referrerId = optionalString(formData.get("referrerId"));
  if (referrerId) fd.set("referrerId", referrerId);
  return createLead(_prev, fd);
}
