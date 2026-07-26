/**
 * Modelli di vista + etichette IT per la UI "Campagne cross-sell" (Fase 0 — simulazione).
 *
 * NB: le forme dei dati riflettono le firme ASSUNTE delle funzioni in `src/lib/campaigns/*`
 * (implementate da un altro agente). Sono documentate qui per fare da contratto. Se le firme
 * reali differiscono, la riconciliazione dei tipi è centrale.
 */

export type CampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";

/** Riga di analitiche per campagna — ritornata da getCampaignAnalytics(). */
export type CampaignAnalyticsRow = {
  campaignId: string;
  key: string;
  name: string;
  description: string | null;
  priority: number;
  status: CampaignStatus;
  targetServiceSlug: string;
  requiresAnyOwnedSlug: string[];
  excludesOwnedSlug: string[];
  stepCount: number;
  activeEnrollments: number;
  totalEnrollments: number;
  /** Invii SIMULATI (Fase 0: nessun invio reale). */
  simulatedSends: number;
  opened: number;
  clicked: number;
  converted: number;
  /** 0..1 */
  conversionRate: number;
};

/** Voce timeline campagne di un cliente — ritornata da getClientCampaignTimeline(). */
export type ClientCampaignTimelineEntry = {
  campaignId: string;
  campaignName: string;
  status: string;
  enrolledAt: Date;
  currentStepIndex: number;
  convertedAt: Date | null;
  exitReason: string | null;
  simulated: boolean;
};

/** Campagna idonea in simulazione — ritornata da eligibleCampaignsForClient(). */
export type EligibleCampaignEntry = {
  campaignId: string;
  campaignName: string;
  targetServiceSlug: string;
  priority: number;
  status: CampaignStatus;
  reason?: string | null;
};

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT: "Bozza",
  ACTIVE: "Attiva",
  PAUSED: "In pausa",
  ARCHIVED: "Archiviata",
};

export const CAMPAIGN_STATUS_BADGE: Record<CampaignStatus, "secondary" | "success" | "warning" | "outline"> = {
  DRAFT: "secondary",
  ACTIVE: "success",
  PAUSED: "warning",
  ARCHIVED: "outline",
};

/** Stato iscrizione cliente (enum non ancora fissato lato lib): fallback al valore grezzo. */
export function enrollmentStatusLabel(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: "In corso",
    ENROLLED: "In corso",
    COMPLETED: "Completata",
    CONVERTED: "Convertito",
    EXITED: "Uscito",
    UNENROLLED: "Uscito",
    PAUSED: "In pausa",
  };
  return map[status] ?? status;
}

export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return "0%";
  return `${Math.round(ratio * 100)}%`;
}

/**
 * Regola di idoneità in linguaggio umano.
 * Es: "Per clienti che hanno già Fibra TIM ma non ancora TIM Vision".
 */
export function eligibilityDescription(
  targetName: string,
  requiresNames: string[],
  excludesNames: string[],
): string {
  const parts: string[] = [];
  if (requiresNames.length > 0) {
    parts.push(`Per clienti che hanno già ${requiresNames.join(" o ")}`);
  } else {
    parts.push("Per tutti i clienti");
  }
  parts.push(`ma non ancora ${targetName}`);
  if (excludesNames.length > 0) {
    parts.push(`escludendo chi ha ${excludesNames.join(", ")}`);
  }
  return parts.join(", ").replace(", ma", " ma");
}
