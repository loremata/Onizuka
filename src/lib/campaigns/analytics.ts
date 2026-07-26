/**
 * Analitiche del motore campagne cross-sell.
 *
 * Query efficienti (groupBy, niente N+1). In Fase 0 gli invii sono per lo più
 * SIMULATED e open/click sono nulli: i campi sono già predisposti per la Fase 1.
 */

import { prisma } from "@/lib/prisma";
import type { CampaignStatus } from "@prisma/client";

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
  /** Iscritti per stato. */
  active: number;
  converted: number;
  exited: number;
  completed: number;
  suppressed: number;
  /** Totale iscritti (somma degli stati). */
  enrolledTotal: number;
  /** Alias per la UI (= active / enrolledTotal). */
  activeEnrollments: number;
  totalEnrollments: number;
  /** Invii per tipo. */
  simulatedSends: number;
  realSends: number;
  opened: number;
  clicked: number;
  /** Tasso di conversione = converted / (converted + completed + exited). 0-1. */
  conversionRate: number;
};

/**
 * Aggregati per campagna (una o tutte). Usa groupBy per non iterare i record.
 * Se `campaignId` è passato, filtra a quella campagna.
 */
export async function getCampaignAnalytics(campaignId?: string): Promise<CampaignAnalyticsRow[]> {
  const campaignWhere = campaignId ? { id: campaignId } : {};
  const enrollWhere = campaignId ? { campaignId } : {};

  const [campaigns, enrollGroups, enrollments] = await Promise.all([
    prisma.crossSellCampaign.findMany({
      where: campaignWhere,
      select: {
        id: true, key: true, name: true, description: true, priority: true, status: true,
        targetServiceSlug: true, requiresAnyOwnedSlug: true, excludesOwnedSlug: true,
        _count: { select: { steps: true } },
      },
      orderBy: { priority: "asc" },
    }),
    // Iscritti per (campagna, stato).
    prisma.campaignEnrollment.groupBy({
      by: ["campaignId", "status"],
      where: enrollWhere,
      _count: { _all: true },
    }),
    // enrollmentId→campaignId per mappare gli invii una sola volta (niente N+1).
    prisma.campaignEnrollment.findMany({
      where: enrollWhere,
      select: { id: true, campaignId: true },
    }),
  ]);

  const campaignByEnrollment = new Map(enrollments.map((e) => [e.id, e.campaignId]));
  const enrollmentIds = enrollments.map((e) => e.id);

  // Aggregati invio per (iscrizione, stato) + open/click, con una singola query ciascuno.
  const [sendAgg, openedRows, clickedRows] = enrollmentIds.length
    ? await Promise.all([
        prisma.campaignSend.groupBy({
          by: ["enrollmentId", "status"],
          where: { enrollmentId: { in: enrollmentIds } },
          _count: { _all: true },
        }),
        prisma.campaignSend.findMany({
          where: { openedAt: { not: null }, enrollmentId: { in: enrollmentIds } },
          select: { enrollmentId: true },
        }),
        prisma.campaignSend.findMany({
          where: { clickedAt: { not: null }, enrollmentId: { in: enrollmentIds } },
          select: { enrollmentId: true },
        }),
      ])
    : [[], [], []] as const;

  // Indicizza gli aggregati per campagna.
  const enrollByCampaign = new Map<string, Record<string, number>>();
  for (const g of enrollGroups) {
    const rec = enrollByCampaign.get(g.campaignId) ?? {};
    rec[g.status] = g._count._all;
    enrollByCampaign.set(g.campaignId, rec);
  }

  const sendByCampaign = new Map<string, { simulated: number; real: number }>();
  for (const g of sendAgg) {
    const cId = campaignByEnrollment.get(g.enrollmentId);
    if (!cId) continue;
    const rec = sendByCampaign.get(cId) ?? { simulated: 0, real: 0 };
    if (g.status === "SIMULATED") rec.simulated += g._count._all;
    else if (g.status === "SENT") rec.real += g._count._all;
    sendByCampaign.set(cId, rec);
  }

  const openedByCampaign = new Map<string, number>();
  for (const r of openedRows) {
    const cId = campaignByEnrollment.get(r.enrollmentId);
    if (cId) openedByCampaign.set(cId, (openedByCampaign.get(cId) ?? 0) + 1);
  }
  const clickedByCampaign = new Map<string, number>();
  for (const r of clickedRows) {
    const cId = campaignByEnrollment.get(r.enrollmentId);
    if (cId) clickedByCampaign.set(cId, (clickedByCampaign.get(cId) ?? 0) + 1);
  }

  return campaigns.map((c) => {
    const e = enrollByCampaign.get(c.id) ?? {};
    const active = e.ACTIVE ?? 0;
    const converted = e.CONVERTED ?? 0;
    const exited = e.EXITED ?? 0;
    const completed = e.COMPLETED ?? 0;
    const suppressed = e.SUPPRESSED ?? 0;
    const enrolledTotal = active + converted + exited + completed + suppressed;
    const s = sendByCampaign.get(c.id) ?? { simulated: 0, real: 0 };
    const closedOutcomes = converted + completed + exited;
    return {
      campaignId: c.id,
      key: c.key,
      name: c.name,
      description: c.description,
      priority: c.priority,
      status: c.status,
      targetServiceSlug: c.targetServiceSlug,
      requiresAnyOwnedSlug: c.requiresAnyOwnedSlug,
      excludesOwnedSlug: c.excludesOwnedSlug,
      stepCount: c._count.steps,
      active,
      converted,
      exited,
      completed,
      suppressed,
      enrolledTotal,
      activeEnrollments: active,
      totalEnrollments: enrolledTotal,
      simulatedSends: s.simulated,
      realSends: s.real,
      opened: openedByCampaign.get(c.id) ?? 0,
      clicked: clickedByCampaign.get(c.id) ?? 0,
      conversionRate: closedOutcomes > 0 ? converted / closedOutcomes : 0,
    };
  });
}

export type ClientCampaignTimelineItem = {
  enrollmentId: string;
  campaignId: string;
  campaignKey: string;
  campaignName: string;
  status: string;
  enrolledAt: Date;
  currentStepIndex: number;
  simulated: boolean;
  convertedAt: Date | null;
  exitedAt: Date | null;
  exitReason: string | null;
  sends: Array<{
    stepIndex: number;
    status: string;
    scheduledFor: Date;
    sentAt: Date | null;
    openedAt: Date | null;
    clickedAt: Date | null;
  }>;
};

/**
 * Timeline campagne di un cliente: iscrizioni + invii, ordinati cronologicamente.
 * Una sola query con include: nessun N+1.
 */
export async function getClientCampaignTimeline(clientId: string): Promise<ClientCampaignTimelineItem[]> {
  const enrollments = await prisma.campaignEnrollment.findMany({
    where: { clientId },
    orderBy: { enrolledAt: "asc" },
    select: {
      id: true,
      campaignId: true,
      status: true,
      enrolledAt: true,
      currentStepIndex: true,
      simulated: true,
      convertedAt: true,
      exitedAt: true,
      exitReason: true,
      campaign: { select: { key: true, name: true } },
      sends: {
        orderBy: { stepIndex: "asc" },
        select: { stepIndex: true, status: true, scheduledFor: true, sentAt: true, openedAt: true, clickedAt: true },
      },
    },
  });

  return enrollments.map((e) => ({
    enrollmentId: e.id,
    campaignId: e.campaignId,
    campaignKey: e.campaign.key,
    campaignName: e.campaign.name,
    status: e.status,
    enrolledAt: e.enrolledAt,
    currentStepIndex: e.currentStepIndex,
    simulated: e.simulated,
    convertedAt: e.convertedAt,
    exitedAt: e.exitedAt,
    exitReason: e.exitReason,
    sends: e.sends,
  }));
}
