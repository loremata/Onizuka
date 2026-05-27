/**
 * Embedding locale deterministico (trigram hashing) — nessuna API esterna.
 * Attivo con ONIZUKA_DEDUPE_LOCAL=1 o quando OpenAI non è configurato.
 */

import {
  applyDimScaleToVector,
  getDedupeModelWeightsCache,
} from "@/lib/dedupe-model-weights";

const DIM = 256;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9@.+]+/i)
    .filter((t) => t.length >= 2);
}

function hashTrigram(token: string, dim: number): number[] {
  const v = new Array<number>(dim).fill(0);
  const s = `  ${token}  `;
  for (let i = 0; i < s.length - 2; i++) {
    const tri = s.slice(i, i + 3);
    let h = 0;
    for (let j = 0; j < tri.length; j++) h = (h * 31 + tri.charCodeAt(j)) >>> 0;
    v[h % dim] += 1;
  }
  return v;
}

export function isLocalDedupeMlEnabled(): boolean {
  if (process.env.ONIZUKA_DEDUPE_LOCAL === "0") return false;
  if (process.env.ONIZUKA_DEDUPE_LOCAL === "1") return true;
  return !process.env.OPENAI_API_KEY?.trim();
}

/** Vettore 256-dim L2-normalizzato da testo anagrafica. */
export function computeLocalClientEmbedding(text: string): number[] {
  const tokens = tokenize(text);
  const v = new Array<number>(DIM).fill(0);
  for (const t of tokens) {
    const partial = hashTrigram(t, DIM);
    for (let i = 0; i < DIM; i++) v[i]! += partial[i]!;
  }
  if (tokens.length === 0) return v;
  let norm = 0;
  for (let i = 0; i < DIM; i++) norm += v[i]! * v[i]!;
  norm = Math.sqrt(norm) || 1;
  const normalized = v.map((x) => x / norm);
  return applyDimScaleToVector(normalized, getDedupeModelWeightsCache());
}

export function localEmbeddingDimension(): number {
  return DIM;
}
