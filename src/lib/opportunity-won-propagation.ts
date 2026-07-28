import { prisma } from "@/lib/prisma";

export type OpportunityWonResult = {
  /**
   * `false` = la transazione è fallita e NIENTE è stato scritto, stato WON compreso.
   * Prima l'errore veniva inghiottito e il chiamante festeggiava lo stesso: audit log
   * "vinta", toast verde, e l'opportunità ancora OPEN al primo refresh.
   */
  ok: boolean;
  clientId: string | null;
  promotedClient: boolean;
  activatedServiceSlug: string | null;
  convertedLead: boolean;
};

const EMPTY: OpportunityWonResult = {
  ok: true,
  clientId: null,
  promotedClient: false,
  activatedServiceSlug: null,
  convertedLead: false,
};

const FAILED: OpportunityWonResult = { ...EMPTY, ok: false };

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
    const result = await prisma.$transaction(async (tx) => {
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
        return { ok: true, clientId, promotedClient: false, activatedServiceSlug: null, convertedLead: false };
      }

      await tx.opportunity.update({ where: { id: opportunityId }, data: { status: "WON" } });

      let promotedClient = false;
      let activatedServiceSlug: string | null = null;
      let convertedLead = false;

      if (clientId) {
        // 1) WON ⇒ cliente ATTIVO: forza CLIENTE/ACTIVE_CLIENT (riattiva DORMANT/EX).
        const client = await tx.client.findUnique({
          where: { id: clientId },
          select: {
            status: true,
            relationshipState: true,
            marketingConsentBasis: true,
            marketingOptOutAt: true,
          },
        });
        if (client && (client.relationshipState !== "CLIENTE" || client.status !== "ACTIVE_CLIENT")) {
          // Chi diventa cliente ha acquistato ⇒ la base marketing sale a
          // SOFT_OPT_IN (art. 130 c.4), salvo disiscrizione o base già EXPLICIT.
          // Anche il hook post-commit lo fa (copre gli altri percorsi), ma qui
          // è in transazione: promozione e base viaggiano insieme.
          const upgradeBasis =
            !client.marketingOptOutAt &&
            (client.marketingConsentBasis === "NONE" ||
              client.marketingConsentBasis === "LEGITIMATE_INTEREST");
          await tx.client.update({
            where: { id: clientId },
            data: {
              relationshipState: "CLIENTE",
              status: "ACTIVE_CLIENT",
              ...(upgradeBasis ? { marketingConsentBasis: "SOFT_OPT_IN" as const } : {}),
            },
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
        // `Lead.convertedClientId` è @unique: se un ALTRO lead punta già a questo
        // cliente (succede quando due lead condividono P.IVA/CF e riusano lo stesso
        // Client), scriverlo qui solleverebbe P2002 e farebbe rollback dell'intera
        // vincita. In quel caso teniamo solo il link satellite `clientId`.
        const alreadyConverted = clientId
          ? await tx.lead.findFirst({
              where: { convertedClientId: clientId, id: { not: opp.leadId } },
              select: { id: true },
            })
          : null;

        await tx.lead.update({
          where: { id: opp.leadId },
          data: {
            status: "CONVERTED",
            commercialProspectStage: "WON",
            ...(clientId
              ? alreadyConverted
                ? { clientId }
                : { convertedClientId: clientId, clientId }
              : {}),
          },
        });
        convertedLead = true;
      }

      return { ok: true, clientId, promotedClient, activatedServiceSlug, convertedLead };
    });

    // Effetti collaterali POST-commit (best-effort: non devono invalidare la vincita).
    if (result.clientId) {
      // Cliente promosso/servizio attivato ⇒ riconcilia subito le iscrizioni alle campagne.
      const { onClientCommercialStateChanged } = await import("@/lib/campaigns/client-commercial-events");
      void onClientCommercialStateChanged(result.clientId, { reason: "opportunity_won" }).catch(() => {});

      // Convertito a CLIENTE ⇒ ferma l'outreach a freddo (basta un lead che ha vinto).
      const { stopActiveOutreachSequences } = await import("@/lib/outreach-sequence-stop");
      void stopActiveOutreachSequences({ clientId: result.clientId, reason: "converted" }).catch(() => {});
    }

    return result;
  } catch (e) {
    console.error("propagateOpportunityWon failed", e);
    return FAILED;
  }
}
