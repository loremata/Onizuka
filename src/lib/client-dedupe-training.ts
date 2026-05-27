import { findClientDuplicateGroups } from "@/lib/client-dedupe";
import { trainDedupeWeightsFromRecords } from "@/lib/client-dedupe-train-local";
import { prisma } from "@/lib/prisma";
import { computeLocalClientEmbedding } from "@/lib/client-dedupe-local-ml";
import { syncClientDedupePgvector } from "@/lib/client-dedupe-pgvector";
import {
  refreshDedupeModelWeightsCache,
  setDedupeModelWeightsCache,
} from "@/lib/dedupe-model-weights";

export type DedupeTrainingRecord = {
  clientAId: string;
  clientBId: string;
  label: "duplicate" | "distinct";
  companyA: string;
  companyB: string;
};

/** Esporta dataset JSONL per training esterno (coppie duplicate note + campione negativo). */
export async function exportDedupeTrainingDataset(limit = 500): Promise<{
  records: DedupeTrainingRecord[];
  format: "jsonl";
}> {
  const clients = await prisma.client.findMany({
    orderBy: { updatedAt: "desc" },
    take: 300,
    select: {
      id: true,
      companyName: true,
      contactEmail: true,
      vatNumber: true,
      phone: true,
      dedupeEmbedding: true,
    },
  });

  const records: DedupeTrainingRecord[] = [];

  const groups = await findClientDuplicateGroups({ fuzzyIndexedClients: 5000 });
  for (const g of groups) {
    const list = g.clients;
    for (let i = 0; i < list.length - 1; i++) {
      for (let j = i + 1; j < list.length; j++) {
        records.push({
          clientAId: list[i]!.id,
          clientBId: list[j]!.id,
          label: "duplicate",
          companyA: list[i]!.companyName,
          companyB: list[j]!.companyName,
        });
        if (records.length >= limit) break;
      }
      if (records.length >= limit) break;
    }
    if (records.length >= limit) break;
  }

  for (let i = 0; i < clients.length - 1 && records.length < limit; i += 7) {
    const a = clients[i]!;
    const b = clients[i + 1]!;
    if (a.vatNumber && b.vatNumber && a.vatNumber !== b.vatNumber) {
      records.push({
        clientAId: a.id,
        clientBId: b.id,
        label: "distinct",
        companyA: a.companyName,
        companyB: b.companyName,
      });
    }
  }

  return { records: records.slice(0, limit), format: "jsonl" };
}

/** Import pesi custom e re-backfill embedding (MVP training loop). */
export async function importDedupeModelWeights(params: {
  weightsJson: string;
  notes?: string;
}): Promise<{ ok: true; version: number } | { error: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(params.weightsJson);
  } catch {
    return { error: "weightsJson non è JSON valido." };
  }

  const existing = await prisma.dedupeModelConfig.findUnique({ where: { id: "default" } });
  const version = (existing?.version ?? 0) + 1;

  await prisma.dedupeModelConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      version,
      weightsJson: JSON.stringify(parsed).slice(0, 500000),
      datasetNotes: params.notes?.slice(0, 2000) ?? null,
    },
    update: {
      version,
      weightsJson: JSON.stringify(parsed).slice(0, 500000),
      datasetNotes: params.notes?.slice(0, 2000) ?? null,
    },
  });

  const clients = await prisma.client.findMany({
    take: 100,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      companyName: true,
      contactEmail: true,
      vatNumber: true,
      phone: true,
    },
  });

  for (const c of clients) {
    const text = [c.companyName, c.contactEmail, c.vatNumber ?? "", c.phone ?? ""].join(" | ");
    const emb = computeLocalClientEmbedding(text);
    await prisma.client.update({
      where: { id: c.id },
      data: { dedupeEmbedding: emb },
    });
    await syncClientDedupePgvector(c.id, emb);
  }

  await refreshDedupeModelWeightsCache();
  return { ok: true, version };
}

/** Addestramento in-app (CPU) + import pesi + re-backfill fino a `backfillLimit` clienti. */
export async function trainAndApplyDedupeModel(params?: {
  datasetLimit?: number;
  backfillLimit?: number;
}): Promise<
  | { ok: true; version: number; pairs: number; backfilled: number; weightsJson: string }
  | { error: string }
> {
  const limit = params?.datasetLimit ?? 500;
  const { records } = await exportDedupeTrainingDataset(limit);
  if (records.length < 3) {
    return { error: "Dataset insufficiente (minimo 3 coppie). Esegui prima una scansione dedupe." };
  }

  setDedupeModelWeightsCache(null);
  const weights = trainDedupeWeightsFromRecords(records);
  const weightsJson = JSON.stringify(weights);
  const imported = await importDedupeModelWeights({ weightsJson, notes: "train in-app CPU" });
  if ("error" in imported) return imported;

  const backfillLimit = params?.backfillLimit ?? 500;
  const clients = await prisma.client.findMany({
    take: backfillLimit,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      companyName: true,
      contactEmail: true,
      vatNumber: true,
      phone: true,
    },
  });

  for (const c of clients) {
    const text = [c.companyName, c.contactEmail, c.vatNumber ?? "", c.phone ?? ""].join(" | ");
    const emb = computeLocalClientEmbedding(text);
    await prisma.client.update({ where: { id: c.id }, data: { dedupeEmbedding: emb } });
    await syncClientDedupePgvector(c.id, emb);
  }

  return {
    ok: true,
    version: imported.version,
    pairs: records.length,
    backfilled: clients.length,
    weightsJson,
  };
}

export async function getDedupeModelConfig(): Promise<{
  version: number;
  updatedAt: Date | null;
  hasWeights: boolean;
}> {
  const row = await prisma.dedupeModelConfig.findUnique({ where: { id: "default" } });
  return {
    version: row?.version ?? 0,
    updatedAt: row?.updatedAt ?? null,
    hasWeights: Boolean(row?.weightsJson?.trim()),
  };
}
