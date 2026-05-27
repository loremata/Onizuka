import { prisma } from "@/lib/prisma";
import { assertMergeClientsAllowed } from "@/lib/client-merge-guard";
import { resolveMergedClientFields, type MergeFieldPicks } from "@/lib/client-merge-fields";

export async function mergeClients(
  targetId: string,
  sourceId: string,
  fieldPicks?: MergeFieldPicks
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (targetId === sourceId) {
    return { ok: false, error: "Sorgente e destinazione coincidono." };
  }

  const [target, source] = await Promise.all([
    prisma.client.findUnique({ where: { id: targetId } }),
    prisma.client.findUnique({ where: { id: sourceId } }),
  ]);

  if (!target || !source) {
    return { ok: false, error: "Cliente non trovato." };
  }

  const guard = assertMergeClientsAllowed(target, source);
  if (!guard.ok) return guard;

  const mergedFields = resolveMergedClientFields(target, source, fieldPicks);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.client.update({
        where: { id: targetId },
        data: {
          companyName: mergedFields.companyName,
          contactEmail: mergedFields.contactEmail,
          vatNumber: mergedFields.vatNumber,
          phone: mergedFields.phone,
        },
      });

      const move = { clientId: targetId };

      await tx.timeEntry.updateMany({ where: { clientId: sourceId }, data: move });
      await tx.postItem.updateMany({ where: { clientId: sourceId }, data: move });
      await tx.webhookSubscription.updateMany({ where: { clientId: sourceId }, data: move });
      await tx.flowTask.updateMany({
        where: { relatedClientId: sourceId },
        data: { relatedClientId: targetId },
      });
      await tx.memoryItem.updateMany({
        where: { relatedClientId: sourceId },
        data: { relatedClientId: targetId },
      });
      await tx.opportunity.updateMany({ where: { clientId: sourceId }, data: move });
      await tx.asset.updateMany({ where: { clientId: sourceId }, data: move });
      await tx.clientContact.updateMany({ where: { clientId: sourceId }, data: move });
      await tx.clientTicket.updateMany({ where: { clientId: sourceId }, data: move });
      await tx.outreachDraft.updateMany({ where: { clientId: sourceId }, data: move });
      await tx.outreachSequence.updateMany({ where: { clientId: sourceId }, data: move });
      await tx.clientCommercialService.updateMany({ where: { clientId: sourceId }, data: move });
      await tx.digitalAudit.updateMany({ where: { clientId: sourceId }, data: move });
      await tx.financeEntry.updateMany({ where: { clientId: sourceId }, data: move });
      await tx.clientMilestone.updateMany({ where: { clientId: sourceId }, data: move });

      const sourceLead = await tx.lead.findFirst({ where: { convertedClientId: sourceId } });
      if (sourceLead) {
        const targetHasLead = await tx.lead.findFirst({ where: { convertedClientId: targetId } });
        if (!targetHasLead) {
          await tx.lead.update({
            where: { id: sourceLead.id },
            data: { convertedClientId: targetId },
          });
        } else {
          await tx.lead.update({
            where: { id: sourceLead.id },
            data: { convertedClientId: null },
          });
        }
      }

      await tx.user.updateMany({
        where: { clientId: sourceId },
        data: { clientId: null },
      });

      await tx.client.delete({ where: { id: sourceId } });
    });

    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Merge non riuscito (verifica vincoli univoci)." };
  }
}
