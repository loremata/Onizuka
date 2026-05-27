"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { MemoryScope, MemorySensitivity, MemorySource } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { logAuditEvent } from "@/lib/admin-audit-log";
import { requireAdminArea } from "@/lib/admin-session";
import { prepareMemoryContentForStorage } from "@/lib/memory-crypto";
import { syncMemoryItemEmbedding } from "@/lib/memory-embedding";
import { reindexMemoryEmbeddings } from "@/lib/memory-reindex";
import { prisma } from "@/lib/prisma";

export type MemoryActionResult = { error: string } | null;

const SCOPES: MemoryScope[] = [
  "PERSONAL",
  "BUSINESS",
  "ASSET",
  "CLIENT",
  "EPISODIC",
  "DOCUMENTAL",
  "SENSITIVE",
];

const SENSITIVITIES: MemorySensitivity[] = ["LOW", "MEDIUM", "HIGH"];

const SOURCES: MemorySource[] = ["MANUAL", "VOICE", "CHAT", "DOCUMENT", "SYSTEM"];

function parseTags(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 32);
}

function parseScope(raw: string | null): MemoryScope | null {
  if (!raw) return null;
  return SCOPES.includes(raw as MemoryScope) ? (raw as MemoryScope) : null;
}

function parseSensitivity(raw: string | null): MemorySensitivity {
  if (!raw || !SENSITIVITIES.includes(raw as MemorySensitivity)) return "LOW";
  return raw as MemorySensitivity;
}

function parseSource(raw: string | null): MemorySource {
  if (!raw || !SOURCES.includes(raw as MemorySource)) return "MANUAL";
  return raw as MemorySource;
}

const ensureAdmin = requireAdminArea;

export async function createMemoryItem(
  _prev: MemoryActionResult,
  formData: FormData
): Promise<MemoryActionResult> {
  const session = await ensureAdmin();

  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();
  const scope = parseScope((formData.get("scope") as string) ?? null);
  const sensitivity = parseSensitivity((formData.get("sensitivity") as string) ?? null);
  const source = parseSource((formData.get("source") as string) ?? null);
  const tags = parseTags((formData.get("tags") as string) ?? null);
  const relatedClientId = (formData.get("relatedClientId") as string)?.trim() || null;
  const relatedAssetId = (formData.get("relatedAssetId") as string)?.trim() || null;

  if (!title) return { error: "Il titolo è obbligatorio." };
  if (!content) return { error: "Il contenuto è obbligatorio." };
  if (!scope) return { error: "Ambito (scope) non valido." };

  if (relatedClientId) {
    const c = await prisma.client.findUnique({ where: { id: relatedClientId } });
    if (!c) return { error: "Cliente collegato non trovato." };
  }

  if (relatedAssetId) {
    const a = await prisma.asset.findUnique({ where: { id: relatedAssetId } });
    if (!a) return { error: "Asset collegato non trovato." };
    if (relatedClientId && a.clientId !== relatedClientId) {
      return { error: "L'asset non appartiene al cliente collegato." };
    }
  }

  const stored = prepareMemoryContentForStorage(content, sensitivity);

  try {
    const item = await prisma.memoryItem.create({
      data: {
        title,
        content: stored.content,
        contentEncrypted: stored.contentEncrypted,
        scope,
        sensitivity,
        source,
        tags,
        relatedClientId,
        relatedAssetId,
        ownerUserId: session.user.id,
      },
    });
    void logAuditEvent({
      actorUserId: session.user.id,
      action: "memory.create",
      entityType: "memory",
      entityId: item.id,
      summary: `Creata memoria «${title}»`,
    });
    void syncMemoryItemEmbedding(item.id).catch(() => undefined);
  } catch (e) {
    console.error(e);
    return { error: "Salvataggio memoria non riuscito." };
  }

  revalidatePath("/admin/memory");
  revalidatePath("/admin/search");
  revalidatePath("/admin");
  if (relatedClientId) revalidatePath(`/admin/clients/${relatedClientId}`);
  redirect("/admin/memory");
}

export async function updateMemoryItem(
  memoryId: string,
  _prev: MemoryActionResult,
  formData: FormData
): Promise<MemoryActionResult> {
  const session = await ensureAdmin();

  const existing = await prisma.memoryItem.findFirst({
    where: { id: memoryId, ownerUserId: session.user.id },
  });
  if (!existing) return { error: "Voce memoria non trovata." };

  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();
  const scope = parseScope((formData.get("scope") as string) ?? null);
  const sensitivity = parseSensitivity((formData.get("sensitivity") as string) ?? null);
  const source = parseSource((formData.get("source") as string) ?? null);
  const tags = parseTags((formData.get("tags") as string) ?? null);
  const relatedClientId = (formData.get("relatedClientId") as string)?.trim() || null;
  const relatedAssetId = (formData.get("relatedAssetId") as string)?.trim() || null;

  if (!title) return { error: "Il titolo è obbligatorio." };
  if (!content) return { error: "Il contenuto è obbligatorio." };
  if (!scope) return { error: "Ambito (scope) non valido." };

  if (relatedClientId) {
    const c = await prisma.client.findUnique({ where: { id: relatedClientId } });
    if (!c) return { error: "Cliente collegato non trovato." };
  }

  if (relatedAssetId) {
    const a = await prisma.asset.findUnique({ where: { id: relatedAssetId } });
    if (!a) return { error: "Asset collegato non trovato." };
    if (relatedClientId && a.clientId !== relatedClientId) {
      return { error: "L'asset non appartiene al cliente collegato." };
    }
  }

  const stored = prepareMemoryContentForStorage(content, sensitivity);

  try {
    await prisma.memoryItem.update({
      where: { id: memoryId },
      data: {
        title,
        content: stored.content,
        contentEncrypted: stored.contentEncrypted,
        scope,
        sensitivity,
        source,
        tags,
        relatedClientId,
        relatedAssetId,
      },
    });
    void logAuditEvent({
      actorUserId: session.user.id,
      action: "memory.update",
      entityType: "memory",
      entityId: memoryId,
      summary: `Aggiornata memoria «${title}»`,
    });
    void syncMemoryItemEmbedding(memoryId).catch(() => undefined);
  } catch (e) {
    console.error(e);
    return { error: "Aggiornamento memoria non riuscito." };
  }

  revalidatePath("/admin/memory");
  revalidatePath("/admin/audit");
  revalidatePath(`/admin/memory/${memoryId}/edit`);
  revalidatePath("/admin/search");
  revalidatePath("/admin");
  if (existing.relatedClientId) revalidatePath(`/admin/clients/${existing.relatedClientId}`);
  if (relatedClientId) revalidatePath(`/admin/clients/${relatedClientId}`);
  redirect("/admin/memory");
}

export async function deleteMemoryItem(
  _prev: MemoryActionResult,
  formData: FormData
): Promise<MemoryActionResult> {
  const session = await ensureAdmin();
  const id = (formData.get("id") as string)?.trim();
  if (!id) return { error: "ID mancante." };

  const existing = await prisma.memoryItem.findFirst({
    where: { id, ownerUserId: session.user.id },
  });
  if (!existing) return { error: "Voce memoria non trovata." };

  try {
    await prisma.memoryItem.delete({ where: { id } });
    void logAuditEvent({
      actorUserId: session.user.id,
      action: "memory.delete",
      entityType: "memory",
      entityId: id,
      summary: `Eliminata memoria «${existing.title}»`,
    });
  } catch (e) {
    console.error(e);
    return { error: "Eliminazione non riuscita." };
  }

  revalidatePath("/admin/memory");
  revalidatePath("/admin/audit");
  revalidatePath("/admin/search");
  revalidatePath("/admin");
  if (existing.relatedClientId) revalidatePath(`/admin/clients/${existing.relatedClientId}`);
  redirect("/admin/memory");
}

export async function reindexAllMemoryEmbeddings(): Promise<
  { error: string } | { ok: true; processed: number; indexed: number; skipped: number }
> {
  const session = await ensureAdmin();
  const result = await reindexMemoryEmbeddings(session.user.id, 50);
  revalidatePath("/admin/memory");
  return { ok: true, ...result };
}
