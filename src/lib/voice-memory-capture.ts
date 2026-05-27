import type { MemoryScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { prepareMemoryContentForStorage } from "@/lib/memory-crypto";
import { syncMemoryItemEmbedding } from "@/lib/memory-embedding";

export type VoiceMemoryCaptureResult = { id: string; title: string };

/** Salva nota vocale in memoria episodica (bassa sensibilità). */
export async function captureVoiceMemory(
  ownerUserId: string,
  raw: string,
  scope: MemoryScope = "EPISODIC"
): Promise<VoiceMemoryCaptureResult> {
  const content = raw.trim().slice(0, 4000);
  const title = content.slice(0, 80) || "Nota vocale";
  const stored = prepareMemoryContentForStorage(content, "LOW");

  const item = await prisma.memoryItem.create({
    data: {
      title,
      content: stored.content,
      contentEncrypted: stored.contentEncrypted,
      scope,
      sensitivity: "LOW",
      source: "VOICE",
      tags: ["voice"],
      ownerUserId,
    },
  });

  await syncMemoryItemEmbedding(item.id).catch(() => undefined);

  return { id: item.id, title: item.title };
}
