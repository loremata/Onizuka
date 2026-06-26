"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { ClientKind, ClientMacroCategory, ClientStatus } from "@prisma/client";
import { inferClientKind } from "@/lib/client-kind";
import { normalizeFiscalCode, normalizeFiscalIdentity, normalizeVatNumber } from "@/lib/fiscal-normalize";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { logAdminAction } from "@/lib/admin-audit-log";
import { clientStatusOptions } from "@/lib/crm-client-status";
import { normalizeClientAccountingCode } from "@/lib/finance-accounting-accounts";
import { staffCanPerformAction } from "@/lib/staff-action-permissions";
import { logWorkspaceAudit } from "@/lib/workspace-audit";
import { assertFiscalIdentityUnique } from "@/lib/client-fiscal-identity";
import { formatFiscalUniqueViolation } from "@/lib/fiscal-unique-error";
import { lifecycleForRelationshipState } from "@/lib/client-lifecycle";

type ActionResult = { error: string } | null;

function clientDbError(e: unknown, fallback: string): ActionResult {
  const fiscal = formatFiscalUniqueViolation(e);
  if (fiscal) return { error: fiscal };
  console.error(e);
  return { error: fallback };
}

function parseClientStatus(raw: string | null): ClientStatus | null {
  if (!raw) return null;
  return clientStatusOptions.includes(raw as ClientStatus) ? (raw as ClientStatus) : null;
}

/** Cambia lo stato relazione (Lead / Cliente / Ex cliente) — toggle libero dalla scheda. */
export async function setClientRelationshipState(clientId: string, formData: FormData) {
  await requireAdminArea();
  const raw = formData.get("relationshipState");
  const state = raw === "LEAD" || raw === "CLIENTE" || raw === "EX_CLIENTE" ? raw : null;
  if (!state) return;
  // Single source of truth: aggiorno macro-stato E sotto-fase funnel insieme, sempre coerenti.
  const current = await prisma.client.findUnique({ where: { id: clientId }, select: { status: true } });
  if (!current) return;
  const next = lifecycleForRelationshipState(state, current.status);
  await prisma.client.update({
    where: { id: clientId },
    data: { relationshipState: next.relationshipState, status: next.status },
  });
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/clients");
}

function optionalString(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s ? s : null;
}

function parseKindMacroFields(formData: FormData) {
  const kindRaw = optionalString(formData.get("kind"));
  const macroRaw = optionalString(formData.get("clientMacroCategory"));
  const vatNumber = normalizeVatNumber(optionalString(formData.get("vatNumber")));
  const fiscalCode = normalizeFiscalCode(optionalString(formData.get("fiscalCode")));
  const kind: ClientKind =
    kindRaw === "PRIVATE" || kindRaw === "BUSINESS"
      ? kindRaw
      : inferClientKind({ vatNumber, fiscalCode });
  const clientMacroCategory: ClientMacroCategory | null =
    macroRaw === "RETAIL_STORE" || macroRaw === "DIGITAL_AI" || macroRaw === "MIXED"
      ? macroRaw
      : null;
  return { kind, fiscalCode, vatNumber, clientMacroCategory };
}

async function ensureAdmin() {
  const session = await requireAdminArea();
  return session;
}

export async function createClient(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  const session = await ensureAdmin();

  const companyName = formData.get("companyName") as string;
  const slugInput = (formData.get("slug") as string)?.trim();
  const contactEmail = (formData.get("contactEmail") as string)?.trim();
  const status = parseClientStatus((formData.get("status") as string) ?? null) ?? "ACTIVE_CLIENT";
  const notes = optionalString(formData.get("notes"));
  const { kind, fiscalCode, vatNumber, clientMacroCategory } = parseKindMacroFields(formData);
  const phone = optionalString(formData.get("phone"));
  const website = optionalString(formData.get("website"));
  const address = optionalString(formData.get("address"));
  const city = optionalString(formData.get("city"));
  const countryRaw = optionalString(formData.get("country"));
  const country = countryRaw ?? "IT";
  const driveFolderUrl = optionalString(formData.get("driveFolderUrl"));
  const accountingCodeRaw = optionalString(formData.get("accountingCode"));
  const accountingCode = normalizeClientAccountingCode(accountingCodeRaw);
  if (accountingCodeRaw && !accountingCode) {
    return { error: "Conto PDC non valido (3–12 caratteri alfanumerici)." };
  }
  const slaRawCreate = optionalString(formData.get("ticketSlaHours"));
  const ticketSlaHours =
    slaRawCreate && Number.isFinite(Number(slaRawCreate)) && Number(slaRawCreate) > 0 && Number(slaRawCreate) <= 720
      ? Math.floor(Number(slaRawCreate))
      : null;

  if (!companyName?.trim()) return { error: "La ragione sociale è obbligatoria." };
  if (!contactEmail?.trim()) return { error: "L'email di contatto è obbligatoria." };

  const fiscalConflict = await assertFiscalIdentityUnique({ vatNumber, fiscalCode });
  if (fiscalConflict) return { error: fiscalConflict.error };

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

  try {
    const client = await prisma.client.create({
      data: {
        companyName: companyName.trim(),
        slug: finalSlug,
        contactEmail: contactEmail,
        status,
        kind,
        fiscalCode,
        clientMacroCategory,
        notes,
        vatNumber,
        phone,
        website,
        address,
        city,
        country,
        driveFolderUrl,
        accountingCode,
        ticketSlaHours,
      },
    });
    void logAdminAction({
      actorUserId: session.user.id,
      action: "client.create",
      entityType: "client",
      entityId: client.id,
      summary: `Creato cliente «${client.companyName}»`,
    });
  } catch (e) {
    return clientDbError(e, "Creazione cliente non riuscita.");
  }

  revalidatePath("/admin/clients");
  revalidatePath("/admin/audit");
  revalidatePath("/admin");
  revalidatePath("/admin/search");
  redirect("/admin/clients");
}

export async function updateClient(
  clientId: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  const session = await ensureAdmin();

  const companyName = formData.get("companyName") as string;
  const slugInput = (formData.get("slug") as string)?.trim();
  const contactEmail = (formData.get("contactEmail") as string)?.trim();
  const status = parseClientStatus((formData.get("status") as string) ?? null) ?? "ACTIVE_CLIENT";
  const notes = optionalString(formData.get("notes"));
  const { kind, fiscalCode, vatNumber, clientMacroCategory } = parseKindMacroFields(formData);
  const phone = optionalString(formData.get("phone"));
  const website = optionalString(formData.get("website"));
  const address = optionalString(formData.get("address"));
  const city = optionalString(formData.get("city"));
  const countryRaw = optionalString(formData.get("country"));
  const country = countryRaw ?? "IT";
  const driveFolderUrl = optionalString(formData.get("driveFolderUrl"));
  const accountingCodeRaw = optionalString(formData.get("accountingCode"));
  const accountingCode = normalizeClientAccountingCode(accountingCodeRaw);
  if (accountingCodeRaw && !accountingCode) {
    return { error: "Conto PDC non valido (3–12 caratteri alfanumerici)." };
  }
  const slaRaw = optionalString(formData.get("ticketSlaHours"));
  const ticketSlaHours =
    slaRaw && Number.isFinite(Number(slaRaw)) && Number(slaRaw) > 0 && Number(slaRaw) <= 720
      ? Math.floor(Number(slaRaw))
      : null;

  if (!companyName?.trim()) return { error: "La ragione sociale è obbligatoria." };
  if (!contactEmail?.trim()) return { error: "L'email di contatto è obbligatoria." };

  const fiscalConflict = await assertFiscalIdentityUnique({
    vatNumber,
    fiscalCode,
    excludeClientId: clientId,
  });
  if (fiscalConflict) return { error: fiscalConflict.error };

  const slug = slugify(slugInput || companyName);
  if (!slug) return { error: "Impossibile generare lo slug." };

  const existing = await prisma.client.findFirst({
    where: { slug, id: { not: clientId } },
  });
  if (existing) return { error: "Un altro cliente usa già questo slug." };

  try {
    await prisma.client.update({
      where: { id: clientId },
      data: {
        companyName: companyName.trim(),
        slug,
        contactEmail,
        status,
        kind,
        fiscalCode,
        clientMacroCategory,
        notes,
        vatNumber,
        phone,
        website,
        address,
        city,
        country,
        driveFolderUrl,
        accountingCode,
        ticketSlaHours,
      },
    });
    // Canonico recapiti: tiene allineato il referente primario con la scheda cliente.
    await prisma.clientContact.updateMany({
      where: { clientId, isPrimary: true },
      data: { email: contactEmail, phone },
    });
    void logAdminAction({
      actorUserId: session.user.id,
      action: "client.update",
      entityType: "client",
      entityId: clientId,
      summary: `Aggiornato cliente «${companyName.trim()}»`,
    });
  } catch (e) {
    return clientDbError(e, "Aggiornamento cliente non riuscito.");
  }

  revalidatePath("/admin/clients");
  revalidatePath("/admin/audit");
  revalidatePath("/admin");
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/search");
  redirect("/admin/clients");
}

export async function deleteClient(clientId: string): Promise<ActionResult> {
  const session = await ensureAdmin();
  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, staffDeniedActions: true },
  });
  if (!staffCanPerformAction(actor?.role, actor?.staffDeniedActions, "client.delete")) {
    return { error: "Non hai il permesso di eliminare clienti." };
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { companyName: true, workspaceId: true },
  });
  if (!client) return { error: "Cliente non trovato." };

  try {
    await prisma.client.delete({ where: { id: clientId } });
    if (client.workspaceId) {
      void logWorkspaceAudit({
        workspaceId: client.workspaceId,
        actorUserId: session.user.id,
        action: "client.delete",
        entityType: "client",
        entityId: clientId,
        summary: `Eliminato cliente «${client.companyName}»`,
      });
    }
  } catch (e) {
    console.error(e);
    return { error: "Eliminazione cliente non riuscita. Potrebbero esserci dati collegati." };
  }

  void logAdminAction({
    actorUserId: session.user.id,
    action: "client.delete",
    entityType: "client",
    entityId: clientId,
    summary: `Eliminato cliente «${client.companyName}»`,
  });

  revalidatePath("/admin/clients");
  revalidatePath("/admin");
  revalidatePath("/admin/search");
  revalidatePath("/admin/audit");
  redirect("/admin/clients");
}
