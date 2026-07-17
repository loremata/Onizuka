import { chatCompletion, isLlmConfigured } from "@/lib/llm-client";
import type { SocialInsights } from "@/lib/social-insights";

export type InsightsNarrative = { text: string; aiGenerated: boolean };

/** Riassunto compatto e testo di fallback deterministico (usato se l'AI non è configurata). */
export function fallbackNarrative(insights: SocialInsights, clientName: string): string {
  if (!insights.hasData) {
    return `Nessun dato pubblicato negli ultimi ${insights.windowDays} giorni per ${clientName}. Programma e pubblica contenuti per generare insight.`;
  }
  const lines: string[] = [];
  lines.push(
    `Negli ultimi ${insights.windowDays} giorni ${clientName} ha pubblicato ${insights.totalPublished} contenuti, ` +
      `con ${insights.totals.reach.toLocaleString("it-IT")} di reach e un engagement rate del ${insights.totals.engagementRate}%.`
  );
  if (insights.bestPlatform) {
    lines.push(`Canale migliore: ${insights.bestPlatform.label} (${insights.bestPlatform.engagementRate}%).`);
  }
  if (insights.bestDayOfWeek) lines.push(`Giorno più performante: ${insights.bestDayOfWeek.label}.`);
  lines.push("");
  lines.push("Azioni consigliate:");
  for (const s of insights.suggestions) lines.push(`• ${s.title}: ${s.detail}`);
  return lines.join("\n");
}

/** Riduce gli insight a un JSON compatto per il prompt (niente dati superflui). */
export function compactStats(insights: SocialInsights) {
  return {
    finestra_giorni: insights.windowDays,
    post_pubblicati: insights.totalPublished,
    totali: insights.totals,
    per_piattaforma: insights.byPlatform.map((p) => ({
      canale: p.label,
      post: p.publishedCount,
      reach: p.reach,
      engagement: p.engagement,
      engagement_rate: p.engagementRate,
    })),
    canale_migliore: insights.bestPlatform?.label ?? null,
    giorno_migliore: insights.bestDayOfWeek?.label ?? null,
    fascia_oraria_migliore: insights.bestTimeBucket?.label ?? null,
    trend_engagement_rate: insights.trend,
    top_post: insights.topPosts.map((p) => ({
      canale: p.label,
      testo: p.captionPreview,
      engagement: p.engagement,
      reach: p.reach,
    })),
  };
}

/**
 * Genera una sintesi + azioni prioritizzate a partire dagli insight.
 * Usa l'LLM se configurato (OPENAI_API_KEY), altrimenti degrada al testo rule-based.
 */
export async function generateInsightsNarrative(
  insights: SocialInsights,
  clientName: string
): Promise<InsightsNarrative> {
  if (!insights.hasData || !isLlmConfigured()) {
    return { text: fallbackNarrative(insights, clientName), aiGenerated: false };
  }

  const system =
    "Sei un social media strategist per PMI locali italiane. Rispondi in italiano, conciso e pratico, " +
    "senza fuffa da marketing. Usa i numeri forniti, non inventarne altri. " +
    "Struttura: 2 righe di sintesi, poi 3-5 azioni concrete e prioritizzate (una per riga, con il perché).";
  const user =
    `Cliente: ${clientName}. Dati social (JSON):\n${JSON.stringify(compactStats(insights))}\n\n` +
    "Scrivi la sintesi e le azioni.";

  const text = await chatCompletion({ system, user, maxTokens: 500 });
  if (!text) return { text: fallbackNarrative(insights, clientName), aiGenerated: false };
  return { text, aiGenerated: true };
}
