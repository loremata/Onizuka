import { BRAND_PROPOSAL_TEMPLATES } from "@/lib/commercial-catalog-seed";

function applyTemplatePlaceholders(
  text: string,
  companyName: string,
  problem: string,
  offer: string
): string {
  return text
    .replace(/\{\{companyName\}\}/g, companyName)
    .replace(/\{\{problem\}\}/g, problem)
    .replace(/\{\{offer\}\}/g, offer);
}

/** Prima email post-audit: template brand se disponibile, altrimenti testo contestuale. */
export function buildFirstAuditOutreachEmail(params: {
  companyName: string;
  priorityProblem: string;
  brandSlug?: string | null;
  brandName?: string | null;
  serviceName?: string | null;
  overallScore?: number | null;
}): { subject: string; body: string } {
  const companyName = params.companyName.trim() || "la vostra azienda";
  const problem = params.priorityProblem.trim() || "migliorare la presenza digitale";
  const offer =
    params.brandName && params.serviceName
      ? `${params.brandName} — ${params.serviceName}`
      : params.serviceName ?? params.brandName ?? "una consulenza mirata";

  const slug = params.brandSlug?.trim().toLowerCase();
  const tpl = slug ? BRAND_PROPOSAL_TEMPLATES[slug] : undefined;

  if (tpl) {
    const subject = applyTemplatePlaceholders(tpl.subject, companyName, problem, offer);
    const bodyBase = applyTemplatePlaceholders(tpl.body, companyName, problem, offer);
    const scoreNote =
      params.overallScore != null
        ? `\n\nHo analizzato la vostra presenza digitale (punteggio sintetico ${params.overallScore}/100): l'area prioritaria è ${problem.toLowerCase()}.`
        : `\n\nDall'analisi emerge un'opportunità su ${problem.toLowerCase()}.`;
    return {
      subject,
      body: `${bodyBase}${scoreNote}\n\nSe vi va, possiamo confrontarci in una breve call questa settimana.\n\nCordiali saluti,\nLorenzo Matarazzo`,
    };
  }

  return {
    subject: `Opportunità digitale per ${companyName}`,
    body: `Buongiorno,

ho dato un'occhiata alla presenza digitale di ${companyName}${
      params.overallScore != null ? ` (sintesi audit: ${params.overallScore}/100)` : ""
    }.

Emergono margini concreti su ${problem.toLowerCase()}.

Un intervento su ${offer} potrebbe portare risultati misurabili senza dispersione.

Se vi va, possiamo confrontarci in una breve call questa settimana.

Cordiali saluti,
Lorenzo Matarazzo`,
  };
}
