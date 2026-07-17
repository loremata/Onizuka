import { chatCompletion, isLlmConfigured } from "@/lib/llm-client";
import type { SocialInsights } from "@/lib/social-insights";
import { compactStats, fallbackNarrative } from "@/lib/social-insights-ai";

export type Lens = { key: string; role: string; text: string };

export type PanelResult = {
  aiGenerated: boolean;
  model: string | null;
  narrative: string;
  lenses: Lens[];
};

/**
 * Il "team di esperti": ogni ruolo studia gli stessi dati da un'angolazione diversa,
 * poi un direttore concilia i pareri in un piano prioritizzato.
 */
const LENSES: { key: string; role: string; brief: string }[] = [
  {
    key: "content",
    role: "Stratega dei contenuti",
    brief:
      "Analizza quali formati/temi funzionano e quali no. Suggerisci cosa replicare e cosa smettere di fare.",
  },
  {
    key: "cadence",
    role: "Analista di cadenza e orari",
    brief:
      "Analizza frequenza, giorni e fasce orarie. Suggerisci quando e quanto pubblicare per massimizzare l'engagement.",
  },
  {
    key: "channels",
    role: "Consulente mix canali",
    brief:
      "Confronta le piattaforme per resa. Suggerisci dove investire di più e dove ridurre o cambiare approccio.",
  },
  {
    key: "local",
    role: "Growth advisor per PMI locali",
    brief:
      "Guarda alla crescita locale (community, offerte, Google Business, recensioni). Suggerisci azioni pratiche da negozio.",
  },
];

export async function runInsightsPanel(
  insights: SocialInsights,
  clientName: string,
  analyticsContext?: unknown
): Promise<PanelResult> {
  if (!insights.hasData || !isLlmConfigured()) {
    return {
      aiGenerated: false,
      model: null,
      narrative: fallbackNarrative(insights, clientName),
      lenses: [],
    };
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const analytics = analyticsContext ? `\nDati Analytics (sito/ads/follower/pubblico):\n${JSON.stringify(analyticsContext)}` : "";
  const stats = JSON.stringify(compactStats(insights)) + analytics;

  const lenses: Lens[] = [];
  for (const l of LENSES) {
    const system =
      `Sei un ${l.role} per PMI locali italiane. ${l.brief} ` +
      "Rispondi in italiano, massimo 4 bullet concreti e azionabili. " +
      "Usa solo i numeri forniti, non inventarne. Niente fuffa da marketing.";
    const text = await chatCompletion({
      system,
      user: `Cliente: ${clientName}. Dati social (JSON):\n${stats}`,
      maxTokens: 300,
    });
    if (text) lenses.push({ key: l.key, role: l.role, text });
  }

  if (lenses.length === 0) {
    return { aiGenerated: false, model: null, narrative: fallbackNarrative(insights, clientName), lenses: [] };
  }

  const directorSystem =
    "Sei il direttore marketing che sintetizza i pareri del team. Rispondi in italiano: " +
    "2 righe di sintesi, poi 5 azioni prioritizzate (una per riga, con il perché in mezza frase). " +
    "Non inventare numeri, basati sui dati e sui pareri.";
  const directorUser =
    `Cliente: ${clientName}. Dati (JSON):\n${stats}\n\nPareri del team:\n` +
    lenses.map((l) => `## ${l.role}\n${l.text}`).join("\n\n");

  const narrative =
    (await chatCompletion({ system: directorSystem, user: directorUser, maxTokens: 550 })) ??
    fallbackNarrative(insights, clientName);

  return { aiGenerated: true, model, narrative, lenses };
}
