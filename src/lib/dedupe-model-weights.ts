import { prisma } from "@/lib/prisma";

export type DedupeModelWeights = {
  featureWeights?: { cosine?: number };
  bias?: number;
  /** Moltiplicatori per dimensione embedding (256). */
  dimScale?: number[];
};

let cached: DedupeModelWeights | null = null;

export function setDedupeModelWeightsCache(weights: DedupeModelWeights | null): void {
  cached = weights;
}

export function getDedupeModelWeightsCache(): DedupeModelWeights | null {
  return cached;
}

export function parseDedupeModelWeights(json: string | null | undefined): DedupeModelWeights | null {
  if (!json?.trim()) return null;
  try {
    const p = JSON.parse(json) as DedupeModelWeights;
    if (p && typeof p === "object") return p;
  } catch {
    return null;
  }
  return null;
}

/** Carica pesi da DB in cache processo (sync read in embedding). */
export async function refreshDedupeModelWeightsCache(): Promise<DedupeModelWeights | null> {
  const row = await prisma.dedupeModelConfig.findUnique({
    where: { id: "default" },
    select: { weightsJson: true },
  });
  const parsed = parseDedupeModelWeights(row?.weightsJson);
  cached = parsed;
  return parsed;
}

export function applyDimScaleToVector(v: number[], weights: DedupeModelWeights | null): number[] {
  const scale = weights?.dimScale;
  if (!scale?.length) return v;
  const out = [...v];
  for (let i = 0; i < out.length; i++) {
    const s = scale[i];
    if (typeof s === "number" && Number.isFinite(s) && s > 0) out[i]! *= s;
  }
  let norm = 0;
  for (let i = 0; i < out.length; i++) norm += out[i]! * out[i]!;
  norm = Math.sqrt(norm) || 1;
  return out.map((x) => x / norm);
}
