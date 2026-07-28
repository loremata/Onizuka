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
      // Relazioni vitali prima mancanti: senza questo spostamento venivano CANCELLATE
      // alla delete del source (onDelete Cascade) → perdita dei contratti ricorrenti.
      await tx.clientRetailContract.updateMany({ where: { clientId: sourceId }, data: move });
      await tx.clientCommitment.updateMany({ where: { clientId: sourceId }, data: move });
      await tx.clientOnboardingItem.updateMany({ where: { clientId: sourceId }, data: move });
      await tx.socialInboxComment.updateMany({ where: { clientId: sourceId }, data: move });

      // Relazioni senza vincoli di unicità: spostamento diretto.
      // StoreSale è SetNull (le vendite restavano orfane = compensi non più
      // riconducibili a nessuno); le altre erano Cascade = cancellate in silenzio.
      await tx.storeSale.updateMany({ where: { clientId: sourceId }, data: move });
      await tx.competitor.updateMany({ where: { clientId: sourceId }, data: move });

      // Relazioni con vincoli di unicità: prima si eliminano le righe del source
      // che collidono con quelle già presenti sul target (vince il target), poi si
      // sposta il resto. Senza questo passaggio la transazione fallirebbe in blocco.
      await tx.$executeRaw`
        DELETE FROM "SocialAccount" s
        WHERE s."clientId" = ${sourceId}
          AND EXISTS (
            SELECT 1 FROM "SocialAccount" t
            WHERE t."clientId" = ${targetId}
              AND t."platform" = s."platform"
              AND t."externalAccountId" = s."externalAccountId"
          )`;
      await tx.socialAccount.updateMany({ where: { clientId: sourceId }, data: move });

      await tx.$executeRaw`
        DELETE FROM "AnalyticsConnection" s
        WHERE s."clientId" = ${sourceId}
          AND EXISTS (
            SELECT 1 FROM "AnalyticsConnection" t
            WHERE t."clientId" = ${targetId}
              AND t."source" = s."source"
              AND t."externalId" = s."externalId"
          )`;
      await tx.analyticsConnection.updateMany({ where: { clientId: sourceId }, data: move });

      await tx.$executeRaw`
        DELETE FROM "AnalyticsMetric" s
        WHERE s."clientId" = ${sourceId}
          AND EXISTS (
            SELECT 1 FROM "AnalyticsMetric" t
            WHERE t."clientId" = ${targetId}
              AND t."source" = s."source"
              AND t."metricKey" = s."metricKey"
              AND t."dimension" = s."dimension"
              AND t."date" = s."date"
          )`;
      await tx.analyticsMetric.updateMany({ where: { clientId: sourceId }, data: move });

      // Report insight: uno solo per cliente (clientId @unique).
      const targetInsight = await tx.socialInsightReport.findUnique({
        where: { clientId: targetId },
        select: { id: true },
      });
      if (targetInsight) {
        await tx.socialInsightReport.deleteMany({ where: { clientId: sourceId } });
      } else {
        await tx.socialInsightReport.updateMany({ where: { clientId: sourceId }, data: move });
      }

      // Iscrizioni campagne: indice univoco parziale sulle sole ACTIVE.
      const targetActiveCampaignIds = (
        await tx.campaignEnrollment.findMany({
          where: { clientId: targetId, status: "ACTIVE" },
          select: { campaignId: true },
        })
      ).map((e) => e.campaignId);
      if (targetActiveCampaignIds.length) {
        await tx.campaignEnrollment.deleteMany({
          where: { clientId: sourceId, status: "ACTIVE", campaignId: { in: targetActiveCampaignIds } },
        });
      }
      await tx.campaignEnrollment.updateMany({ where: { clientId: sourceId }, data: move });

      // Attributi: dedup su @@unique([clientId, key]) — tieni quelli del target.
      const targetAttrKeys = (
        await tx.clientAttribute.findMany({ where: { clientId: targetId }, select: { key: true } })
      ).map((a) => a.key);
      if (targetAttrKeys.length) {
        await tx.clientAttribute.deleteMany({ where: { clientId: sourceId, key: { in: targetAttrKeys } } });
      }
      await tx.clientAttribute.updateMany({ where: { clientId: sourceId }, data: move });

      // Ruoli persona: dedup su @@unique([personId, clientId]).
      const targetPersonIds = (
        await tx.personClientRole.findMany({ where: { clientId: targetId }, select: { personId: true } })
      ).map((r) => r.personId);
      if (targetPersonIds.length) {
        await tx.personClientRole.deleteMany({ where: { clientId: sourceId, personId: { in: targetPersonIds } } });
      }
      await tx.personClientRole.updateMany({ where: { clientId: sourceId }, data: move });

      // Lead-dossier satellite (Lead.clientId, distinto da convertedClientId gestito sotto).
      await tx.lead.updateMany({ where: { clientId: sourceId }, data: { clientId: targetId } });

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
