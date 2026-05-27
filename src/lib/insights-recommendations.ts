import type { InsightsStats } from "@/lib/insights-stats";

export type InsightRecommendation = {
  id: string;
  title: string;
  detail: string;
  href: string;
  priority: "high" | "medium" | "low";
};

export function buildInsightRecommendations(
  s: InsightsStats & { openTickets?: number; outreachPending?: number }
): InsightRecommendation[] {
  const out: InsightRecommendation[] = [];

  if (s.flowOverdue > 0) {
    out.push({
      id: "flow-overdue",
      title: "Recupera task in ritardo",
      detail: `${s.flowOverdue} task oltre scadenza: blocca il recap e aggiorna Flow.`,
      href: "/admin/flow?due=overdue",
      priority: "high",
    });
  }
  if (s.postsPending > 0) {
    out.push({
      id: "posts-pending",
      title: "Sblocca approvazioni contenuti",
      detail: `${s.postsPending} post in attesa dal portale cliente.`,
      href: "/admin/posts?status=PENDING",
      priority: "high",
    });
  }
  if ((s.openTickets ?? 0) > 0) {
    out.push({
      id: "tickets-open",
      title: "Rispondi ai ticket clienti",
      detail: `${s.openTickets} ticket aperti nel portale.`,
      href: "/admin/client-portal/tickets",
      priority: "high",
    });
  }
  if ((s.outreachPending ?? 0) > 0) {
    out.push({
      id: "reach-pending",
      title: "Approva bozze Reach",
      detail: `${s.outreachPending} email in attesa di approvazione.`,
      href: "/admin/reach",
      priority: "medium",
    });
  }
  if ((s.activeReachSequences ?? 0) > 0) {
    out.push({
      id: "reach-sequences",
      title: "Sequenze Reach attive",
      detail: `${s.activeReachSequences} sequenze follow-up in corso — verifica step in scadenza.`,
      href: "/admin/reach/sequences",
      priority: "medium",
    });
  }
  if (s.flowNoDueDate > 2) {
    out.push({
      id: "flow-no-due",
      title: "Assegna scadenze ai task",
      detail: `${s.flowNoDueDate} task aperti senza data: difficile pianificare il calendario.`,
      href: "/admin/flow",
      priority: "medium",
    });
  }
  if (s.leadsOpen > 5 && s.opportunitiesOpen < 2) {
    out.push({
      id: "convert-leads",
      title: "Converti lead in opportunità",
      detail: `${s.leadsOpen} lead attivi ma poche opportunità in pipeline.`,
      href: "/admin/crm/leads",
      priority: "medium",
    });
  }
  if (s.opportunitiesOpen > 0) {
    out.push({
      id: "pipeline-review",
      title: "Revisiona pipeline",
      detail: `${s.opportunitiesOpen} opportunità aperte: verifica valore e prossimo step.`,
      href: "/admin/crm/pipeline",
      priority: "low",
    });
  }
  if ((s.financeOverdueCount ?? 0) > 0) {
    out.push({
      id: "finance-overdue",
      title: "Recupera incassi scaduti",
      detail: `${s.financeOverdueCount} voci finance in stato scaduto: verifica fatture e solleciti.`,
      href: "/admin/finance",
      priority: "high",
    });
  }
  if ((s.financeGapEur ?? 0) > 0) {
    out.push({
      id: "finance-gap",
      title: "Cashflow sotto target mensile",
      detail: `Gap stimato € ${s.financeGapEur?.toLocaleString("it-IT")} rispetto a € 5.000/mese.`,
      href: "/admin/finance",
      priority: "high",
    });
  }
  if ((s.auditFollowUpTasks ?? 0) > 0) {
    out.push({
      id: "audit-follow-up",
      title: "Task post-audit da completare",
      detail: `${s.auditFollowUpTasks} task generati da audit (Reach / follow-up).`,
      href: "/admin/flow?source=audit",
      priority: "high",
    });
  }
  if ((s.clientsUpsell ?? 0) > 0) {
    out.push({
      id: "upsell-clients",
      title: "Clienti con spazio upsell",
      detail: `${s.clientsUpsell} clienti con 5+ servizi mancanti nel catalogo.`,
      href: "/admin/clients",
      priority: "medium",
    });
  }
  if (s.memoryTotal < 3) {
    out.push({
      id: "memory-seed",
      title: "Arricchisci la memoria",
      detail: "Poche voci memorizzate: annota contesto clienti e decisioni.",
      href: "/admin/memory/new",
      priority: "low",
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 8);
}
