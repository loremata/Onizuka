import type { DedupeTrainingRecord } from "@/lib/client-dedupe-training";
import type { DedupeModelWeights } from "@/lib/dedupe-model-weights";
import { computeLocalClientEmbedding, localEmbeddingDimension } from "@/lib/client-dedupe-local-ml";

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return dot;
}

function sigmoid(x: number): number {
  if (x >= 0) return 1 / (1 + Math.exp(-x));
  const e = Math.exp(x);
  return e / (1 + e);
}

function pairText(r: DedupeTrainingRecord): { a: string; b: string } {
  return { a: r.companyA, b: r.companyB };
}

/**
 * Addestramento logistico leggero su similarità coseno + boost dimensionale.
 * Eseguibile in Node senza GPU (equivalente batch CPU per MVP).
 */
export function trainDedupeWeightsFromRecords(
  records: DedupeTrainingRecord[],
  epochs = 40
): DedupeModelWeights {
  const dim = localEmbeddingDimension();
  if (records.length === 0) {
    return { featureWeights: { cosine: 1 }, bias: 0, dimScale: new Array(dim).fill(1) };
  }

  let w = 2;
  let b = 0;
  const dimScale = new Array<number>(dim).fill(1);
  const lr = 0.15;
  const dimLr = 0.02;

  for (let epoch = 0; epoch < epochs; epoch++) {
    for (const r of records) {
      const { a, b: bt } = pairText(r);
      const embA = computeLocalClientEmbedding(a);
      const embB = computeLocalClientEmbedding(bt);
      const sim = cosine(embA, embB);
      const y = r.label === "duplicate" ? 1 : 0;
      const z = w * sim + b;
      const pred = sigmoid(z);
      const err = pred - y;

      w -= lr * err * sim;
      b -= lr * err;

      if (r.label === "duplicate" && sim < 0.85) {
        for (let i = 0; i < dim; i++) {
          if (embA[i]! > 0.01 && embB[i]! > 0.01) dimScale[i]! += dimLr * (1 - sim);
        }
      } else if (r.label === "distinct" && sim > 0.5) {
        for (let i = 0; i < dim; i++) {
          if (embA[i]! > 0.01 && embB[i]! > 0.01) dimScale[i]! = Math.max(0.5, dimScale[i]! - dimLr * sim);
        }
      }
    }
  }

  for (let i = 0; i < dim; i++) {
    dimScale[i] = Math.min(2, Math.max(0.5, dimScale[i]!));
  }

  return {
    featureWeights: { cosine: Number(w.toFixed(4)) },
    bias: Number(b.toFixed(4)),
    dimScale: dimScale.map((x) => Number(x.toFixed(4))),
  };
}
