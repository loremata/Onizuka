import type { SequenceStepTemplate } from "@/lib/outreach-sequence";

export function parseCustomSequenceSteps(formData: FormData): SequenceStepTemplate[] | { error: string } {
  const steps: SequenceStepTemplate[] = [];

  for (let i = 0; i < 5; i++) {
    const delayRaw = (formData.get(`step_${i}_delay`) as string)?.trim();
    const subject = (formData.get(`step_${i}_subject`) as string)?.trim();
    const body = (formData.get(`step_${i}_body`) as string)?.trim();
    const subjectAlt = (formData.get(`step_${i}_subjectAlt`) as string)?.trim() || undefined;
    const bodyAlt = (formData.get(`step_${i}_bodyAlt`) as string)?.trim() || undefined;
    if (!delayRaw && !subject && !body) continue;
    const delayDays = Number(delayRaw);
    if (Number.isNaN(delayDays) || delayDays < 0) {
      return { error: `Step ${i + 1}: giorni non validi.` };
    }
    if (!subject || !body) {
      return { error: `Step ${i + 1}: oggetto e corpo obbligatori.` };
    }
    steps.push({ delayDays, subject, body, subjectAlt, bodyAlt });
  }

  if (steps.length === 0) {
    return { error: "Aggiungi almeno uno step alla sequenza personalizzata." };
  }

  steps.sort((a, b) => a.delayDays - b.delayDays);
  return steps;
}
