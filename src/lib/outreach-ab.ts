/** A/B subject e body per bozze Reach. */

export type OutreachAbVariant = "A" | "B";

export function pickOutreachSubject(
  draft: { subject: string; subjectAlt?: string | null },
  variant: OutreachAbVariant = "A"
): string {
  if (variant === "B" && draft.subjectAlt?.trim()) {
    return draft.subjectAlt.trim();
  }
  return draft.subject;
}

export function pickOutreachBody(
  draft: { body: string; bodyAlt?: string | null },
  variant: OutreachAbVariant = "A"
): string {
  if (variant === "B" && draft.bodyAlt?.trim()) {
    return draft.bodyAlt.trim();
  }
  return draft.body;
}

export function hasOutreachSubjectAb(draft: { subjectAlt?: string | null }): boolean {
  return Boolean(draft.subjectAlt?.trim());
}

export function hasOutreachBodyAb(draft: { bodyAlt?: string | null }): boolean {
  return Boolean(draft.bodyAlt?.trim());
}

export function hasOutreachAb(draft: {
  subjectAlt?: string | null;
  bodyAlt?: string | null;
}): boolean {
  return hasOutreachSubjectAb(draft) || hasOutreachBodyAb(draft);
}

export function normalizeAbVariant(raw: string | null | undefined): OutreachAbVariant {
  return raw?.toUpperCase() === "B" ? "B" : "A";
}

export type AbWinnerInput = {
  abSentA: number;
  abSentB: number;
  abOpenRateA: number;
  abOpenRateB: number;
  abClickRateA?: number;
  abClickRateB?: number;
};

/** Suggerisce vincitore A/B (aperture, poi click se pari). Min 3 invii per variante. */
export function suggestReachAbWinner(input: AbWinnerInput): OutreachAbVariant | null {
  if (input.abSentA < 3 || input.abSentB < 3) return null;

  const scoreA = input.abOpenRateA * 2 + (input.abClickRateA ?? 0);
  const scoreB = input.abOpenRateB * 2 + (input.abClickRateB ?? 0);
  if (scoreA === scoreB) return null;
  return scoreA > scoreB ? "A" : "B";
}
