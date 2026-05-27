import { askIntentHref, askIntentLabel } from "@/lib/ask-onizuka";
import { orchestrateAsk } from "@/lib/ask-orchestration";
import { chatCompletion, isLlmConfigured } from "@/lib/llm-client";
import { buildAskOperationalContext } from "@/lib/ask-operational-context";
import { formatMemoryRagContext, searchMemoryRag, type MemoryRagHit } from "@/lib/memory-rag";
import { logAiRun } from "@/lib/ai-run-log";

export type AskWithMemoryResult = {
  mode: "llm" | "rules";
  query: string;
  answer: string;
  memoryHits: MemoryRagHit[];
  primaryHref: string;
  primaryLabel: string;
  followUps: { label: string; href: string }[];
};

export async function runAskWithMemory(
  ownerUserId: string,
  rawQuery: string
): Promise<AskWithMemoryResult> {
  const query = rawQuery.trim();
  const orchestration = orchestrateAsk(query);
  const intent = orchestration.primary;
  const primaryHref = askIntentHref(intent);
  const primaryLabel = askIntentLabel(intent);

  const [memoryHits, operationalContext] = await Promise.all([
    searchMemoryRag(ownerUserId, query, 6),
    buildAskOperationalContext(ownerUserId, query),
  ]);
  const memoryContext = formatMemoryRagContext(memoryHits);

  if (isLlmConfigured()) {
    const system = `Sei l'assistente operativo Onizuka per un'agenzia marketing. Rispondi in italiano, conciso (max 6 frasi). Usa solo contesto memoria e dati operativi forniti; se non sai, indica il modulo da aprire. Non inventare dati clienti.`;
    const user = [
      `Domanda: ${query}`,
      memoryContext ? `Contesto memoria:\n${memoryContext}` : "Nessun contesto memoria rilevante.",
      operationalContext ? `Dati operativi:\n${operationalContext}` : "",
      `Modulo suggerito: ${primaryLabel} (${primaryHref})`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const llmAnswer = await chatCompletion({ system, user });
    if (llmAnswer) {
      await logAiRun({
        ownerUserId,
        kind: "ask",
        inputSummary: query,
        outputSummary: llmAnswer.slice(0, 500),
      });
      return {
        mode: "llm",
        query,
        answer: llmAnswer,
        memoryHits,
        primaryHref,
        primaryLabel,
        followUps: orchestration.followUps,
      };
    }
  }

  const intentPart =
    intent.kind === "navigate"
      ? `Ti porto su ${intent.label}.`
      : intent.kind === "prospect_vat"
        ? `Avvio ${intent.label}.`
        : `Eseguo una ricerca globale per «${intent.q}».`;

  const memoryPart =
    memoryHits.length > 0
      ? ` Ho trovato ${memoryHits.length} voci in memoria correlate.`
      : "";
  const opsPart = operationalContext ? " Ho trovato dati CRM/Flow collegati alla domanda." : "";

  return {
    mode: "rules",
    query,
    answer: `${intentPart}${memoryPart}${opsPart} ${orchestration.summary}`.trim(),
    memoryHits,
    primaryHref,
    primaryLabel,
    followUps: orchestration.followUps,
  };
}
