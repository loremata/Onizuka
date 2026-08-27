import type { CommercialProspectStage, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { leadLifecycleForStage } from "@/lib/lead-lifecycle";
import { commercialProspectStageOptions } from "@/lib/commercial-prospect-stage";

/**
 * UN SOLO POSTO DOVE CAMBIA LO STADIO DEL LEAD.
 *
 * Prima ogni percorso (audit, outreach, opportunità, modifica a mano) scriveva
 * `commercialProspectStage` per conto suo. Risultato: il funnel diceva DOVE sta
 * un lead ma non da quanto ci sta, chi ce l'ha portato, né quali passaggi ha
 * saltato — e per capire perché un lead fosse fermo bisognava indovinare.
 *
 * Qui il cambio è una transizione: si legge lo stadio di partenza, si scrive
 * quello nuovo (con lo `status` grossolano coerente, via `leadLifecycleForStage`)
 * e si lascia una riga in `LeadStageEvent`. Chi non cambia stadio non genera
 * rumore: se il lead è già lì, non succede niente.
 *
 * Lo storico è un di più: se la scrittura dell'evento fallisce, il funnel
 * avanza lo stesso. Meglio un passaggio non registrato che un lead bloccato.
 */
export async function setLeadStage(params: {
  /** Filtro dei lead da spostare: `{ id }`, `{ clientId }`, con eventuali guardie. */
  where: Prisma.LeadWhereInput;
  stage: CommercialProspectStage;
  /** Chi ha causato il passaggio: "outreach:invio", "audit:completato", "manuale"… */
  source: string;
  /**
   * Solo in avanti: non regredisce da stadi più avanzati o terminali
   * (WON/LOST/NURTURING stanno in fondo all'ordine). Serve a impedire che un
   * automatismo tardivo riporti indietro un lead già vinto.
   */
  onlyForward?: boolean;
  /** Campi da scrivere insieme allo stadio (es. le note dell'audit). */
  extraData?: Prisma.LeadUncheckedUpdateManyInput;
  /**
   * Client da usare: dentro una transazione va passato `tx`, altrimenti la
   * scrittura dello stadio uscirebbe dalla transazione che la contiene.
   */
  db?: Prisma.TransactionClient;
}): Promise<number> {
  const { where, stage, source, onlyForward, extraData } = params;
  const db = params.db ?? prisma;

  const leads = await db.lead.findMany({
    where,
    select: { id: true, commercialProspectStage: true },
  });
  if (leads.length === 0) return 0;

  const ordine = commercialProspectStageOptions;
  const target = ordine.indexOf(stage);
  const daCambiare = leads.filter((l) => {
    if (l.commercialProspectStage === stage) return false;
    if (!onlyForward) return true;
    // Stadio nullo = nessuno stadio ancora: qualunque target è un avanzamento.
    const corrente = l.commercialProspectStage ? ordine.indexOf(l.commercialProspectStage) : -1;
    return target > corrente;
  });
  if (daCambiare.length === 0) return 0;

  const ids = daCambiare.map((l) => l.id);
  await db.lead.updateMany({
    where: { id: { in: ids } },
    data: { ...extraData, ...leadLifecycleForStage(stage) },
  });

  await db.leadStageEvent
    .createMany({
      data: daCambiare.map((l) => ({
        leadId: l.id,
        fromStage: l.commercialProspectStage,
        toStage: stage,
        source,
      })),
    })
    .catch(() => undefined);

  return daCambiare.length;
}

/** Storico leggibile di un lead, dal passaggio più recente. */
export async function leadStageHistory(leadId: string, take = 20) {
  return prisma.leadStageEvent.findMany({
    where: { leadId },
    orderBy: { at: "desc" },
    take,
    select: { id: true, fromStage: true, toStage: true, source: true, at: true },
  });
}
