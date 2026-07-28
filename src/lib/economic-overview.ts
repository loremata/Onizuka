import { loadFinanceLedgerStats, FINANCE_MONTHLY_TARGET_EUR } from "@/lib/finance-ledger-stats";
import { loadOwnerRecurringMrrEur } from "@/lib/finance-mrr";
import { loadOwnerPipelineForecast } from "@/lib/insights-pipeline-forecast";
import { loadUpcomingFinanceRenewals } from "@/lib/finance-renewals";
import { loadDashboard, currentMonth } from "@/lib/inserimenti/dashboard";

/**
 * PUNTO DELLA SITUAZIONE ECONOMICA — agenzia + negozio in un colpo d'occhio.
 *
 * "Reale" = il netto già consolidato: incassi del mese meno spese pagate
 * (agenzia) più compensi maturati al banco (negozio). "Stimato" = dove si
 * chiude il mese se il ritmo regge: reale + entrate attese − spese attese +
 * proiezione lineare del negozio. Stessa convenzione su entrambi i numeri.
 *
 * IVA: qui si sommano IMPONIBILI e COMPENSI, entrambi senza IVA. Da non
 * confondere con i canoni registrati in /admin/inserimenti, che sono prezzi di
 * listino IVA inclusa: quelli sono un INPUT del calcolo, non un ricavo.
 *
 * I consigli sono regole, non magia: scaduti da sollecitare, gap sul target,
 * la mossa di gara col miglior rapporto (focus del motore compensi), premi a
 * rischio, rinnovi in arrivo.
 */

export type EconomicAdvice = {
  id: string;
  text: string;
  href: string;
  priority: "high" | "medium" | "low";
};

export type EconomicOverview = {
  month: string;
  agenzia: {
    incassatoEur: number;
    attesoEur: number;
    mrrEur: number;
    pipelinePesataLabel: string;
    overdueCount: number;
  };
  /** null = cruscotto negozio non disponibile (i totali sotto sono solo agenzia). */
  negozio: {
    maturatoEur: number;
    proiezioneEur: number | null;
    mesePrecedenteEur: number;
    /** Il piano di qualche brand è provvisorio: cifre da confermare. */
    provisional: boolean;
  } | null;
  /**
   * Reale = incassato agenzia − spese già pagate + maturato negozio.
   * Stimato = reale + atteso agenzia − spese attese + (proiezione − maturato) negozio.
   * Stessa convenzione (netto spese) su entrambi: sono lo stesso numero in due
   * momenti del mese, devono essere confrontabili.
   */
  realeEur: number;
  stimatoEur: number;
  consigli: EconomicAdvice[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;
export const eurLabel = (n: number) =>
  n.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export async function loadEconomicOverview(ownerUserId: string): Promise<EconomicOverview | null> {
  const month = currentMonth();

  const [ledger, mrr, pipeline, renewals, negozioDash] = await Promise.all([
    loadFinanceLedgerStats(ownerUserId),
    loadOwnerRecurringMrrEur(ownerUserId).catch(() => ({ sumEur: 0, count: 0 })),
    loadOwnerPipelineForecast(ownerUserId).catch(() => null),
    loadUpcomingFinanceRenewals(ownerUserId, 30).catch(() => []),
    loadDashboard(ownerUserId, month).catch(() => null),
  ]);

  if (!ledger.ok) return null;
  const l = ledger.stats.raw;

  // Negozio: maturato = grandTotal del motore compensi; proiezione = regola del
  // tre sui giorni lavorati (stessa usata dal cruscotto inserimenti).
  const maturato = negozioDash?.grandTotal ?? 0;
  const giorniPassati = negozioDash ? negozioDash.daysInMonth - negozioDash.daysLeft : 0;
  const proiezione =
    negozioDash && giorniPassati > 0
      ? round2((maturato / giorniPassati) * negozioDash.daysInMonth)
      : null;
  const provisional = Boolean(negozioDash?.blocks.some((b) => b.planStatus === "PROVISIONAL"));

  // Entrambi NETTO spese (oltre che netto IVA): reale usa le spese già pagate,
  // stimato aggiunge attese in entrata e in uscita. Prima il reale era lordo e
  // lo stimato netto: due grandezze diverse affiancate sulla stessa card.
  const realeEur = round2(l.incomeReceived - l.expensePaid + maturato);
  const stimatoEur = round2(
    realeEur + l.incomeExpected - l.expenseExpected + ((proiezione ?? maturato) - maturato)
  );

  // ── Consigli ──────────────────────────────────────────────────────────────
  const consigli: EconomicAdvice[] = [];

  if (ledger.stats.overdueCount > 0) {
    consigli.push({
      id: "finance-overdue",
      text: `Sollecita ${ledger.stats.overdueCount} ${ledger.stats.overdueCount === 1 ? "voce scaduta" : "voci scadute"} in Finance.`,
      href: "/admin/finance",
      priority: "high",
    });
  }

  const focus = negozioDash?.focusTop ?? null;
  if (focus && focus.missing > 0) {
    consigli.push({
      id: "gara-focus",
      text: `Negozio: ${focus.label} — mancano ${focus.missing} pezzi (+€ ${eurLabel(focus.stepValue)} sul mese${focus.unlocksPrize ? `, sblocca ${focus.unlocksPrize}` : ""}).`,
      href: "/admin/inserimenti/gara-tim",
      priority: "high",
    });
  }

  const premioARischio = negozioDash?.outlook?.prizes.find((p) => p.lost);
  if (premioARischio) {
    consigli.push({
      id: "gara-premio-perso",
      text: `Premio ${premioARischio.label}: un cancello è fuori portata a questo ritmo. Verifica se recuperabile.`,
      href: "/admin/inserimenti/gara-tim",
      priority: "medium",
    });
  }

  if (l.gapToTarget > 0) {
    consigli.push({
      id: "finance-gap",
      text: `Mancano € ${eurLabel(l.gapToTarget)} al target agenzia di € ${eurLabel(FINANCE_MONTHLY_TARGET_EUR)}/mese: spingi preventivi e upsell.`,
      href: "/admin/crm/pipeline",
      priority: "medium",
    });
  }

  if (renewals.length > 0) {
    consigli.push({
      id: "renewals",
      text: `${renewals.length} rinnov${renewals.length === 1 ? "o" : "i"} MRR nei prossimi 30 giorni: conferma prima della scadenza.`,
      href: "/admin/insights/forecast",
      priority: "medium",
    });
  }

  if (pipeline && pipeline.openCount === 0) {
    consigli.push({
      id: "pipeline-vuota",
      text: "Nessuna opportunità aperta: la stima del prossimo mese poggia solo su MRR e negozio.",
      href: "/admin/crm/opportunities",
      priority: "low",
    });
  }

  return {
    month,
    agenzia: {
      incassatoEur: round2(l.incomeReceived),
      attesoEur: round2(l.incomeExpected),
      mrrEur: round2(mrr.sumEur),
      pipelinePesataLabel: pipeline?.weightedPipelineLabel ?? "0",
      overdueCount: ledger.stats.overdueCount,
    },
    negozio: negozioDash
      ? {
          maturatoEur: round2(maturato),
          proiezioneEur: proiezione,
          mesePrecedenteEur: round2(negozioDash.prevTotal ?? 0),
          provisional,
        }
      : null,
    realeEur,
    stimatoEur,
    consigli: consigli.slice(0, 5),
  };
}
