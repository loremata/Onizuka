import { chatCompletion, isLlmConfigured } from "@/lib/llm-client";
import { buildAskOperationalContext } from "@/lib/ask-operational-context";
import { formatMemoryRagContext, searchMemoryRag } from "@/lib/memory-rag";
import { logAiRun } from "@/lib/ai-run-log";
import { prisma } from "@/lib/prisma";

export async function replyAssistantChat(
  ownerUserId: string,
  threadId: string,
  userMessage: string
): Promise<{ content: string; mode: "llm" | "rules" }> {
  const trimmed = userMessage.trim();
  if (!trimmed) return { content: "Scrivi un messaggio.", mode: "rules" };

  const [memoryHits, operationalContext] = await Promise.all([
    searchMemoryRag(ownerUserId, trimmed, 6),
    buildAskOperationalContext(ownerUserId, trimmed),
  ]);
  const memoryContext = formatMemoryRagContext(memoryHits);

  if (isLlmConfigured()) {
    const system = `Sei l'assistente Onizuka in chat admin. Rispondi in italiano, utile e conciso. Usa solo contesto fornito; non inventare dati.`;
    const user = [
      `Messaggio: ${trimmed}`,
      memoryContext ? `Memoria:\n${memoryContext}` : "",
      operationalContext ? `Operativo:\n${operationalContext}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const answer = await chatCompletion({ system, user });
    if (answer) {
      await logAiRun({
        ownerUserId,
        kind: "assistant_chat",
        inputSummary: trimmed,
        outputSummary: answer.slice(0, 500),
      });
      return { content: answer, mode: "llm" };
    }
  }

  const fallback =
    memoryHits.length > 0
      ? `Ho ${memoryHits.length} voci memoria correlate. Apri Memoria o Flow per approfondire.`
      : "LLM non configurato. Usa la barra Ask o configura OPENAI_API_KEY.";
  await logAiRun({
    ownerUserId,
    kind: "assistant_chat",
    status: "completed",
    inputSummary: trimmed,
    outputSummary: fallback,
  });
  return { content: fallback, mode: "rules" };
}

export async function touchAssistantThread(threadId: string): Promise<void> {
  await prisma.assistantChatThread.update({
    where: { id: threadId },
    data: { updatedAt: new Date() },
  });
}
