import type { Client } from "@prisma/client";

export type MergeFieldPick = "target" | "source";

export type MergeFieldPicks = {
  companyName?: MergeFieldPick;
  contactEmail?: MergeFieldPick;
  vatNumber?: MergeFieldPick;
  phone?: MergeFieldPick;
};

const MERGEABLE: (keyof MergeFieldPicks)[] = ["companyName", "contactEmail", "vatNumber", "phone"];

/** Campi anagrafici che differiscono tra target e source (per UI merge). */
export function listMergeFieldConflicts(
  target: Pick<Client, "companyName" | "contactEmail" | "vatNumber" | "phone">,
  source: Pick<Client, "companyName" | "contactEmail" | "vatNumber" | "phone">
): (keyof MergeFieldPicks)[] {
  const out: (keyof MergeFieldPicks)[] = [];
  for (const key of MERGEABLE) {
    const t = (target[key] ?? "").trim();
    const s = (source[key] ?? "").trim();
    if (t !== s && (t || s)) out.push(key);
  }
  return out;
}

export function resolveMergedClientFields(
  target: Client,
  source: Client,
  picks?: MergeFieldPicks
): Pick<Client, "companyName" | "contactEmail" | "vatNumber" | "phone"> {
  const resolved = {
    companyName: target.companyName,
    contactEmail: target.contactEmail,
    vatNumber: target.vatNumber,
    phone: target.phone,
  };
  if (!picks) return resolved;

  for (const key of MERGEABLE) {
    const side = picks[key];
    if (side === "source") {
      const v = source[key];
      if (v != null && String(v).trim()) {
        resolved[key] = source[key] as string & null;
      }
    }
  }
  return resolved;
}

export function parseMergeFieldPicksFromForm(formData: FormData): MergeFieldPicks {
  const picks: MergeFieldPicks = {};
  for (const key of MERGEABLE) {
    const raw = formData.get(`merge_${key}`);
    if (raw === "target" || raw === "source") picks[key] = raw;
  }
  return picks;
}
