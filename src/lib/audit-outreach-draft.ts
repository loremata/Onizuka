import { BRAND_PROPOSAL_TEMPLATES } from "@/lib/commercial-catalog-seed";
import type { AuditFinding } from "@/lib/audit-service-recommendations";

/**
 * Email diretta orientata alla vendita, linguaggio semplice e senza brand interni:
 * abbiamo analizzato → queste lacune generano questi problemi → le risolviamo con queste soluzioni
 * → CTA decisa verso consulenza gratuita (con report già pronto da condividere).
 */
function buildStructuredSalesEmail(params: {
  companyName: string;
  findings: AuditFinding[];
}): { subject: string; body: string } {
  const { companyName, findings } = params;
  const n = findings.length;

  const gapsBlock = findings
    .map((f) => `• ${capitalize(f.gap)}: ${f.consequence}.`)
    .join("\n");
  const solutionsBlock = findings.map((f) => `✓ ${capitalize(f.solution)}`).join("\n");

  const subject = `${companyName}: ${n} ${n === 1 ? "area" : "aree"} che oggi vi fanno perdere clienti`;

  const body = `Buongiorno,

abbiamo analizzato la presenza online di ${companyName} e preparato un report dettagliato. Sono emersi alcuni punti che, così come sono oggi, vi fanno perdere clienti:

${gapsBlock}

La buona notizia è che sono tutte situazioni che sappiamo risolvere. In concreto possiamo intervenire con:

${solutionsBlock}

Abbiamo già pronto il report completo della vostra presenza online e saremmo felici di illustrarvelo in una consulenza gratuita, in call o di persona: vi mostriamo le priorità e i risultati che potete ottenere, dati alla mano.

Quando preferite tra questa e la prossima settimana? Indicatemi il giorno e l'orario che vi sono più comodi e organizzo io l'incontro.

Cordiali saluti,
Lorenzo Matarazzo
Online Station`;

  return { subject, body };
}

function capitalize(s: string): string {
  const t = s.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

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
  findings?: AuditFinding[];
}): { subject: string; body: string } {
  const companyName = params.companyName.trim() || "la vostra azienda";

  // Percorso principale: email personalizzata sui problemi reali emersi dall'audit.
  const findings = (params.findings ?? []).filter((f) => f.gap?.trim() && f.solution?.trim()).slice(0, 3);
  if (findings.length > 0) {
    return buildStructuredSalesEmail({ companyName, findings });
  }

  // Fallback (nessuna criticità sopra soglia): template brand o testo generico.
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
