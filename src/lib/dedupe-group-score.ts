import { duplicatePairScore, type DedupePairInput } from "@/lib/client-dedupe-score";

export function maxDuplicateScoreInGroup(
  clients: { companyName: string; contactEmail: string; vatNumber: string | null; phone?: string | null }[]
): number {
  if (clients.length < 2) return clients.length === 1 ? 100 : 0;
  let max = 0;
  for (let i = 0; i < clients.length; i++) {
    for (let j = i + 1; j < clients.length; j++) {
      max = Math.max(max, duplicatePairScore(clients[i] as DedupePairInput, clients[j] as DedupePairInput));
    }
  }
  return max;
}
