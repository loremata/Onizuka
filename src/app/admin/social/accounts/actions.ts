"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireFullAdmin } from "@/lib/admin-session";
import { logAuditEvent } from "@/lib/admin-audit-log";
import { prisma } from "@/lib/prisma";
import { encryptSocialToken } from "@/lib/social-account";
import { collectAccountSnapshot, collectAccountDemographics } from "@/lib/social-account-collector";
import type { Platform } from "@prisma/client";

const PLATFORMS: Platform[] = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "GBP"];

export async function createSocialAccount(
  _prev: unknown,
  formData: FormData
): Promise<{ error: string } | null> {
  const session = await requireFullAdmin();

  const clientId = (formData.get("clientId") as string)?.trim();
  const platformRaw = (formData.get("platform") as string)?.trim();
  const displayName = (formData.get("displayName") as string)?.trim();
  const externalAccountId = (formData.get("externalAccountId") as string)?.trim();
  const accessToken = (formData.get("accessToken") as string)?.trim();

  if (!clientId || !platformRaw || !displayName || !externalAccountId) {
    return { error: "Cliente, piattaforma, nome e ID account sono obbligatori." };
  }
  if (!PLATFORMS.includes(platformRaw as Platform)) {
    return { error: "Piattaforma non valida." };
  }
  if (!accessToken) {
    return { error: "Il token di accesso è obbligatorio per un account gestito (MANAGED)." };
  }

  const platform = platformRaw as Platform;

  // Mappa l'ID inserito nel campo tecnico usato dal publisher di ogni piattaforma.
  const platformFields: {
    pageId?: string;
    igBusinessAccountId?: string;
    authorUrn?: string;
    locationName?: string;
  } = {};
  if (platform === "FACEBOOK" || platform === "INSTAGRAM") platformFields.pageId = externalAccountId;
  if (platform === "INSTAGRAM") platformFields.igBusinessAccountId = externalAccountId;
  if (platform === "LINKEDIN") platformFields.authorUrn = externalAccountId;
  if (platform === "GBP") platformFields.locationName = externalAccountId;

  let created;
  try {
    created = await prisma.socialAccount.create({
      data: {
        clientId,
        platform,
        displayName,
        externalAccountId,
        connectionMode: "MANAGED",
        status: "CONNECTED",
        tokenCipher: encryptSocialToken({ accessToken }),
        ...platformFields,
      },
    });
  } catch (e) {
    console.error(e);
    return { error: "Creazione non riuscita: forse questo account è già collegato per questa piattaforma." };
  }

  void logAuditEvent({
    actorUserId: session.user.id,
    action: "social_account.create",
    entityType: "social_account",
    entityId: created.id,
    summary: `Account ${platform} «${displayName}» collegato (MANAGED)`,
    metadata: { clientId, platform },
  });

  revalidatePath("/admin/social/accounts");
  revalidatePath("/admin/audit");
  redirect("/admin/social/accounts");
}

export async function revokeSocialAccount(formData: FormData) {
  const session = await requireFullAdmin();
  const id = (formData.get("id") as string)?.trim();
  if (!id) return;

  const acc = await prisma.socialAccount.findUnique({ where: { id } });
  if (!acc) return;

  // Revoca = stacca il token ma tiene lo storico (i post restano collegati).
  await prisma.socialAccount.update({
    where: { id },
    data: { status: "REVOKED", tokenCipher: null },
  });

  void logAuditEvent({
    actorUserId: session.user.id,
    action: "social_account.revoke",
    entityType: "social_account",
    entityId: id,
    summary: `Account ${acc.platform} «${acc.displayName}» revocato`,
  });

  revalidatePath("/admin/social/accounts");
  revalidatePath("/admin/audit");
}

export async function snapshotSocialAccount(formData: FormData) {
  await requireFullAdmin();
  const id = (formData.get("id") as string)?.trim();
  if (!id) return;
  const acc = await prisma.socialAccount.findUnique({ where: { id } });
  if (!acc) return;
  await collectAccountSnapshot(acc);
  await collectAccountDemographics(acc);
  revalidatePath("/admin/social/accounts");
  revalidatePath("/admin/analytics");
}

export async function deleteSocialAccount(formData: FormData) {
  const session = await requireFullAdmin();
  const id = (formData.get("id") as string)?.trim();
  if (!id) return;

  const acc = await prisma.socialAccount.findUnique({ where: { id } });
  if (!acc) return;

  // onDelete: SetNull su PostItem.socialAccountId → i post non vengono cancellati.
  await prisma.socialAccount.delete({ where: { id } });

  void logAuditEvent({
    actorUserId: session.user.id,
    action: "social_account.delete",
    entityType: "social_account",
    entityId: id,
    summary: `Account ${acc.platform} «${acc.displayName}» eliminato`,
  });

  revalidatePath("/admin/social/accounts");
  revalidatePath("/admin/audit");
}
