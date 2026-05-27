"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea } from "@/lib/admin-session";
import { logAuditEvent } from "@/lib/admin-audit-log";
import { prisma } from "@/lib/prisma";
import { replyToGbpReview } from "@/lib/gbp-reviews";

export async function replyGbpReviewAction(
  clientId: string,
  reviewId: string,
  replyText: string,
  assetId?: string
): Promise<{ ok: true; note?: string } | { ok: false; error: string }> {
  const session = await requireAdminArea();
  if (!replyText.trim()) return { ok: false, error: "Risposta vuota." };

  let gbpLocationName: string | null = null;
  if (assetId) {
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, clientId },
      select: { gbpLocationName: true },
    });
    gbpLocationName = asset?.gbpLocationName ?? null;
  }

  const result = await replyToGbpReview(session.user.id, reviewId, replyText, gbpLocationName);

  await logAuditEvent({
    actorUserId: session.user.id,
    action: "gbp.review.reply",
    entityType: "Client",
    entityId: clientId,
    summary: `Bozza risposta recensione GBP`,
    metadata: { reviewId, replyPreview: replyText.slice(0, 200) },
  });

  revalidatePath(`/admin/clients/${clientId}`);

  if (result.ok) return { ok: true };
  return { ok: true, note: result.error };
}

