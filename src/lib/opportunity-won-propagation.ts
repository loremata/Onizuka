import { prisma } from "@/lib/prisma";

export type OpportunityWonResult = {
  clientId: string | null;
  promotedClient: boolean;
  activatedServiceSlug: string | null;
  convertedLead: boolean;
};

const EMPTY: OpportunityWonResult = {
  clientId: null,
  promotedClient: false,
  activatedServiceSlug: null,
  convertedLead: false,
};

/**
 * Propaga gli effetti di un'opportunità VINTA. ATOMICO: imposta lo stato WON e tutti
 * gli effetti nella STESSA transazione → o tutto o niente (prima erano update separati
 * best-effort, con finestre di incoerenza se la propagazione falliva a metà).
 * Idempotente: se l'opportunità è già WON non ripropaga.
 *  1. promuove il cliente a CLIENTE/ACTIVE_CLIENT (riattiva anche DORMANT/EX),
 *  2. attiva il ClientCommercialService consigliato dall'audit,
 *  3. segna il lead collegato come convertito (stage WON),
 *  4. aggancia al cliente le altre opportunità del lead.
 */
export async function propagateOpportunityWon(opportunityId: string): Promise<OpportunityWonResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const opp = await tx.opportunity.findUnique({
        where: { id: opportunityId },
        select: {
          id: true,
          status: true,
          clientId: true,
          leadId: true,
          digitalAuditId: true,
          lead: { select: { id: true, clientId: true } },
        },
      });
      if (!opp) return EMPTY;

      const clientId = opp.clientId ?? opp.lead?.clientId ?? null;
      // Idempotente: già vinta ⇒ niente ri-propagazione (es. accettazione di un 2° preventivo).
      if (opp.status === "WON") {
        return { clientId, promotedClient: false, activatedServiceSlug: null, convertedLead: false };
      }

      await tx.opportunity.update({ where: { id: opportunityId }, data: { status: "WON" } });

      let promotedClient = false;
      let activatedServiceSlug: string | null = null;
      let convertedLead = false;

      if (clientId) {
        // 1) WON ⇒ cliente ATTIVO: forza CLIENTE/ACTIVE_CLIENT (riattiva DORMANT/EX).
        const client = await tx.client.findUnique({
          where: { id: clientId },
          select: { status: true, relationshipState: true },
        });
        if (client && (client.relationshipState !== "CLIENTE" || client.status !== "ACTIVE_CLIENT")) {
          await tx.client.update({
            where: { id: clientId },
            data: { relationshipState: "CLIENTE", status: "ACTIVE_CLIENT" },
          });
          promotedClient = true;
        }

        // 2) Attiva il servizio consigliato dall'audit che ha generato l'opportunità.
        if (opp.digitalAuditId) {
          const audit = await tx.digitalAudit.findUnique({
            where: { id: opp.digitalAuditId },
            select: { recommendedService: { select: { id: true, slug: true } } },
          });
          const svc = audit?.recommendedService;
          if (svc) {
            const existing = await tx.clientCommercialService.findUnique({
              where: { clientId_commercialServiceId: { clientId, commercialServiceId: svc.id } },
              select: { since: true },
            });
            await tx.clientCommercialService.upsert({
              where: { clientId_commercialServiceId: { clientId, commercialServiceId: svc.id } },
              update: { active: true, inactiveReason: null, since: existing?.since ?? new Date() },
              create: { clientId, commercialServiceId: svc.id, active: true, since: new Date() },
            });
            activatedServiceSlug = svc.slug;
          }
        }

        // 4) Aggancia al cliente le altre opportunità del lead ancora senza cliente.
        if (opp.leadId) {
          await tx.opportunity.updateMany({
            where: { leadId: opp.leadId, clientId: null },
            data: { clientId, leadId: null },
          });
        }
      }

      // 3) Segna il lead collegato come convertito (stage WON), mantenendo il link satellite.
      if (opp.leadId) {
        await tx.lead.update({
          where: { id: opp.leadId },
          data: {
            status: "CONVERTED",
            commercialProspectStage: "WON",
            ...(clientId ? { convertedClientId: clientId, clientId } : {}),
          },
        });
        convertedLead = true;
      }

      return { clientId, promotedClient, activatedServiceSlug, convertedLead };
    });
  } catch (e) {
    console.error("propagateOpportunityWon failed", e);
    return EMPTY;
  }
}
