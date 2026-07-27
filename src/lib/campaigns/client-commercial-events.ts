import { reconcileClientEnrollments } from "@/lib/campaigns/engine";

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
