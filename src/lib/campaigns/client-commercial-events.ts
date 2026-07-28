import { prisma } from "@/lib/prisma";
import { reconcileClientEnrollments } from "@/lib/campaigns/engine";

/**
 * Linea sulle basi giuridiche decisa il 28/07: legittimo interesse per
 * l'outreach a freddo, soft opt-in per chi è già cliente (art. 130 c.4).
 * Quindi appena un soggetto diventa CLIENTE la sua base sale a SOFT_OPT_IN.
 * Idempotente e con tutte le guardie nel WHERE: non tocca chi si è disiscritto,
 * chi ha già una base uguale o più forte (EXPLICIT), né chi ha ancora l'email
 * segnaposto — il soft opt-in presuppone un recapito raccolto nel contesto
 * della vendita, non un segnaposto interno. Quando il recupero contatti
 * troverà l'email vera, applyFoundContacts assegnerà SOFT_OPT_IN al CLIENTE.
 */
async function upgradeConsentOnPromotion(clientId: string): Promise<void> {
  await prisma.client.updateMany({
    where: {
      id: clientId,
      relationshipState: "CLIENTE",
      marketingOptOutAt: null,
      marketingConsentBasis: { in: ["NONE", "LEGITIMATE_INTEREST"] },
      NOT: [{ contactEmail: { endsWith: "@onizuka.local" } }, { contactEmail: "" }],
    },
    data: { marketingConsentBasis: "SOFT_OPT_IN" },
  });
}

/**
 * HOOK DI PROPAGAZIONE CENTRALE.
 *
 * Va chiamato ogni volta che cambia lo STATO COMMERCIALE di un cliente
 * (relationship state, servizi digitali, contratti retail, opportunità vinta,
 * opt-out marketing...). Riconcilia subito le iscrizioni alle campagne email:
 * arruola i clienti diventati eleggibili e sopprime quelli che non lo sono più.
 *
 * BEST-EFFORT: qualsiasi errore di riconciliazione viene loggato ma NON rilanciato.
 * La riconciliazione delle campagne è un effetto collaterale: non deve mai far
 * fallire l'azione utente (salvataggio cliente, toggle servizio, conversione lead...)
 * che l'ha scatenata. Va quindi invocato DOPO il commit della transazione principale.
 *
 * NB Fase 1: oggi le campagne sono in DRAFT, quindi il reconcile è di fatto un no-op
 * (nessuna campagna ACTIVE da arruolare ⇒ 0 iscrizioni). Il cablaggio deve però
 * essere già presente: quando le campagne passeranno ad ACTIVE l'interconnessione
 * sarà strutturale e non andrà ricablata.
 */
export async function onClientCommercialStateChanged(
  clientId: string,
  opts?: { reason?: string }
): Promise<void> {
  try {
    // Prima il consenso, poi la riconciliazione: così l'arruolamento vede già
    // la base aggiornata (le campagne richiedono SOFT_OPT_IN o EXPLICIT).
    await upgradeConsentOnPromotion(clientId);
    await reconcileClientEnrollments({ clientId, dryRun: false });
  } catch (e) {
    // Non rilanciare: un errore di riconciliazione non deve rompere l'azione utente.
    console.warn(
      `[onClientCommercialStateChanged] reconcile fallito per client ${clientId}` +
        (opts?.reason ? ` (motivo: ${opts.reason})` : ""),
      e
    );
  }
}
