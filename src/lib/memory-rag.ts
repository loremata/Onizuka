import type { MemoryItem, MemoryScope, MemorySensitivity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { maskMemoryContent } from "@/lib/memory-export";
import { readMemoryContentPlain } from "@/lib/memory-crypto";
import { searchMemoryByEmbedding } from "@/lib/memory-embedding";

export type MemoryRagHit = {
  id: string;
  title: string;
  snippet: string;
  scope: MemoryScope;
  score: number;
  href: string;
  clientName: string | null;
};

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9àèéìòù]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 12);
}

function scoreItem(
  item: MemoryItem & { contentEncrypted?: boolean; client?: { companyName: string } | null },
  tokens: string[],
  phrase: string
): number {
  if (tokens.length === 0) return 0;
  const title = item.title.toLowerCase();
  const content = readMemoryContentPlain(item.content, item.contentEncrypted ?? false).toLowerCase();
  const tags = item.tags.map((t) => t.toLowerCase());
  const client = item.client?.companyName?.toLowerCase() ?? "";

  let score = 0;
  if (phrase.length >= 4) {
    if (title.includes(phrase)) score += 10;
    else if (content.includes(phrase)) score += 5;
  }
  for (const t of tokens) {
    if (title.includes(t)) score += 4;
    if (tags.some((tag) => tag.includes(t))) score += 3;
    if (client.includes(t)) score += 2;
    if (content.includes(t)) score += 1;
  }
  return score;
}

function buildSnippet(
  content: string,
  contentEncrypted: boolean,
  sensitivity: MemorySensitivity,
  scope: MemoryScope,
  max = 160
): string {
  const plain = readMemoryContentPlain(content, contentEncrypted);
  const masked = maskMemoryContent(plain, sensitivity, scope, true);
  const flat = masked.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

export async function searchMemoryRag(
  ownerUserId: string,
  query: string,
  limit = 8
): Promise<MemoryRagHit[]> {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const phrase = query.toLowerCase().trim();
  const tokenFilter =
    tokens.length > 0
      ? {
          OR: tokens.flatMap((t) => [
            { title: { contains: t, mode: "insensitive" as const } },
            { content: { contains: t, mode: "insensitive" as const } },
          ]),
        }
      : undefined;

  let candidates = await prisma.memoryItem.findMany({
    where: { ownerUserId, ...tokenFilter },
    include: { client: { select: { companyName: true } } },
    orderBy: { updatedAt: "desc" },
    take: 150,
  });

  if (candidates.length === 0 && tokenFilter) {
    candidates = await prisma.memoryItem.findMany({
      where: { ownerUserId },
      include: { client: { select: { companyName: true } } },
      orderBy: { updatedAt: "desc" },
      take: 150,
    });
  }

  const semantic = await searchMemoryByEmbedding(ownerUserId, query, limit);
  const semanticBoost = new Map(semantic.map((s) => [s.id, s.score * 10]));

  const ranked = candidates
    .map((item) => ({
      item,
      score: scoreItem(item, tokens, phrase) + (semanticBoost.get(item.id) ?? 0),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.item.updatedAt.getTime() - a.item.updatedAt.getTime())
    .slice(0, limit);

  if (ranked.length < limit && semantic.length > 0) {
    const missingIds = semantic.map((s) => s.id).filter((id) => !ranked.some((r) => r.item.id === id));
    if (missingIds.length > 0) {
      const extra = await prisma.memoryItem.findMany({
        where: { id: { in: missingIds.slice(0, limit - ranked.length) } },
        include: { client: { select: { companyName: true } } },
      });
      for (const item of extra) {
        const sem = semantic.find((s) => s.id === item.id);
        ranked.push({ item, score: (sem?.score ?? 0) * 10 });
      }
      ranked.sort((a, b) => b.score - a.score);
    }
  }

  return ranked.slice(0, limit).map(({ item, score }) => ({
    id: item.id,
    title: item.title,
    snippet: buildSnippet(item.content, item.contentEncrypted ?? false, item.sensitivity, item.scope),
    scope: item.scope,
    score,
    href: `/admin/memory/${item.id}/edit`,
    clientName: item.client?.companyName ?? null,
  }));
}

export function formatMemoryRagContext(hits: MemoryRagHit[]): string {
  if (hits.length === 0) return "";
  return hits
    .map(
      (h, i) =>
        `[${i + 1}] ${h.title} (${h.scope}${h.clientName ? ` · ${h.clientName}` : ""})\n${h.snippet}`
    )
    .join("\n\n");
}
