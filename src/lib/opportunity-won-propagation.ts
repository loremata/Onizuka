import { prisma } from "@/lib/prisma";
import { lifecycleForRelationshipState } from "@/lib/client-lifecycle";

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
 * Propaga gli effetti di un'opportunità VINTA — il punto in cui prima il flusso si
 * spezzava (la vittoria mandava solo una notifica). Single source of truth:
 *  1. promuove il cliente a CLIENTE / "Cliente attivo" (stato coerente),
 *  2. attiva il ClientCommercialService consigliato dall'audit (se l'opp viene da audit),
 *  3. segna il lead collegato come convertito (commercialProspectStage = WON),
 *  4. aggancia al cliente le altre opportunità del lead.
 *
 * Best-effort: cattura gli errori e non rilancia, così non blocca mai il cambio di stato.
 */
export async function propagateOpportunityWon(opportunityId: string): Promise<OpportunityWonResult> {
  try {
    const opp = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: {
        id: true,
        clientId: true,
        leadId: true,
        digitalAuditId: true,
        lead: { select: { id: true, clientId: true } },
      },
    });
    if (!opp) return EMPTY;

    const clientId = opp.clientId ?? opp.lead?.clientId ?? null;
    let promotedClient = false;
    let activatedServiceSlug: string | null = null;
    let convertedLead = false;

    if (clientId) {
      // 1) Promuovi il cliente a CLIENTE / Cliente attivo (coerente con il funnel).
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { status: true, relationshipState: true },
      });
      if (client) {
        const lc = lifecycleForRelationshipState("CLIENTE", client.status);
        if (client.relationshipState !== "CLIENTE" || client.status !== lc.status) {
          await prisma.client.update({
            where: { id: clientId },
            data: { relationshipState: lc.relationshipState, status: lc.status },
          });
          promotedClient = true;
        }
      }

      // 2) Attiva il servizio consigliato dall'audit che ha generato l'opportunità.
      if (opp.digitalAuditId) {
        const audit = await prisma.digitalAudit.findUnique({
          where: { id: opp.digitalAuditId },
          select: { recommendedService: { select: { id: true, slug: true } } },
        });
        const svc = audit?.recommendedService;
        if (svc) {
          const existing = await prisma.clientCommercialService.findUnique({
            where: { clientId_commercialServiceId: { clientId, commercialServiceId: svc.id } },
            select: { since: true },
          });
          await prisma.clientCommercialService.upsert({
            where: { clientId_commercialServiceId: { clientId, commercialServiceId: svc.id } },
            update: { active: true, inactiveReason: null, since: existing?.since ?? new Date() },
            create: { clientId, commercialServiceId: svc.id, active: true, since: new Date() },
          });
          activatedServiceSlug = svc.slug;
        }
      }

      // 4) Aggancia al cliente le altre opportunità del lead ancora senza cliente.
      if (opp.leadId) {
        await prisma.opportunity.updateMany({
          where: { leadId: opp.leadId, clientId: null },
          data: { clientId, leadId: null },
        });
      }
    }

    // 3) Segna il lead collegato come convertito (stage WON), mantenendo il link satellite.
    if (opp.leadId) {
      await prisma.lead.update({
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
  } catch (e) {
    console.error("propagateOpportunityWon failed", e);
    return EMPTY;
  }
}
