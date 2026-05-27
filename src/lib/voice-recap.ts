import type { AdminDashboardStats } from "@/lib/admin-dashboard-stats";

export function buildVoiceRecapText(
  stats: AdminDashboardStats,
  timeZoneLabel: string
): string {
  const lines: string[] = [
    `Recap Onizuka. Fuso: ${timeZoneLabel}.`,
    `Hai ${stats.tasksDueToday.length} task in scadenza oggi e ${stats.tasksOverdue} in ritardo.`,
    `${stats.pendingPosts} post attendono approvazione.`,
    `${stats.opportunitiesOpen} opportunità aperte in pipeline.`,
    `${stats.flowOpen} task Flow ancora aperti.`,
  ];
  if (stats.urgentOpen > 0) {
    lines.push(`Attenzione: ${stats.urgentOpen} task urgenti da gestire.`);
  }
  if (stats.dormantClients > 0) {
    lines.push(`${stats.dormantClients} clienti dormienti da riattivare.`);
  }
  lines.push("Apri il Command Center per i dettagli. Buon lavoro.");
  return lines.join(" ");
}
