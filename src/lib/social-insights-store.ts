import { prisma } from "@/lib/prisma";
import { buildSocialInsights } from "@/lib/social-insights";
import { compactStats } from "@/lib/social-insights-ai";
import { runInsightsPanel, type PanelResult } from "@/lib/social-insights-panel";
import { buildAnalyticsContext } from "@/lib/analytics-context";

export type StoredInsightReport = {
  clientId: string;
  windowDays: number;
  aiGenerated: boolean;
  model: string | null;
  narrative: string;
  lenses: { key: string; role: string; text: string }[];
  generatedAt: Date;
};

/**
 * Genera il report del "team di esperti" per un cliente e lo salva (upsert per clientId).
 * Ritorna il panel prodotto.
 */
export async function generateAndStoreInsights(clientId: string): Promise<PanelResult> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { companyName: true },
  });
  const clientName = client?.companyName ?? "Cliente";

  const insights = await buildSocialInsights(clientId);
  const analyticsContext = await buildAnalyticsContext(clientId);
  const panel = await runInsightsPanel(insights, clientName, analyticsContext ?? undefined);

  const payload = {
    windowDays: insights.windowDays,
    aiGenerated: panel.aiGenerated,
    model: panel.model,
    statsJson: JSON.stringify(compactStats(insights)),
    narrative: panel.narrative,
    lensesJson: JSON.stringify(panel.lenses),
    suggestionsJson: JSON.stringify(insights.suggestions),
    generatedAt: new Date(),
  };

  await prisma.socialInsightReport.upsert({
    where: { clientId },
    create: { clientId, ...payload },
    update: payload,
  });

  return panel;
}

/** Legge il report salvato (se esiste) per mostrarlo senza ricalcolo. */
export async function loadStoredInsightReport(clientId: string): Promise<StoredInsightReport | null> {
  const row = await prisma.socialInsightReport.findUnique({ where: { clientId } });
  if (!row) return null;
  let lenses: { key: string; role: string; text: string }[] = [];
  try {
    lenses = row.lensesJson ? JSON.parse(row.lensesJson) : [];
  } catch {
    lenses = [];
  }
  return {
    clientId: row.clientId,
    windowDays: row.windowDays,
    aiGenerated: row.aiGenerated,
    model: row.model,
    narrative: row.narrative,
    lenses,
    generatedAt: row.generatedAt,
  };
}
