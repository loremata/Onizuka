import type { OutreachAbVariant } from "@/lib/outreach-ab";
import { pickOutreachBody, pickOutreachSubject } from "@/lib/outreach-ab";
import { resolveReachAbVariantForSend } from "@/lib/reach-ab-default";

export type SequenceStepContent = {
  subject: string;
  body: string;
  subjectAlt?: string | null;
  bodyAlt?: string | null;
};

/** Bozza Reach da step sequenza con variante A/B dell'owner. */
export async function buildOutreachDraftFromSequenceStep(
  ownerUserId: string,
  step: SequenceStepContent
): Promise<{
  variant: OutreachAbVariant;
  draftFields: {
    subject: string;
    subjectAlt: string | null;
    body: string;
    bodyAlt: string | null;
  };
  previewSubject: string;
  previewBody: string;
}> {
  const variant = await resolveReachAbVariantForSend(ownerUserId, undefined);
  const draftLike = {
    subject: step.subject,
    subjectAlt: step.subjectAlt,
    body: step.body,
    bodyAlt: step.bodyAlt,
  };

  return {
    variant,
    draftFields: {
      subject: step.subject,
      subjectAlt: step.subjectAlt?.trim() || null,
      body: step.body,
      bodyAlt: step.bodyAlt?.trim() || null,
    },
    previewSubject: pickOutreachSubject(draftLike, variant),
    previewBody: pickOutreachBody(draftLike, variant),
  };
}
