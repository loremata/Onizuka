import { BRAND_PROPOSAL_TEMPLATES } from "@/lib/commercial-catalog-seed";
import type { AuditFinding } from "@/lib/audit-service-recommendations";

/** Email diretta orientata alla vendita: "abbiamo notato questi problemi → ecco come li risolviamo". */
function buildStructuredSalesEmail(params: {
  companyName: string;
  findings: AuditFinding[];
  overallScore?: number | null;
}): { subject: string; body: string } {
  const { companyName, findings } = params;
  const n = findings.length;
  const scoreText =
    params.overallScore != null ? ` (indice di presenza online ${params.overallScore}/100)` : "";

  const problemsBlock = findings
    .map((f) => `• ${f.problem}${f.detail ? `: ${f.detail}` : ""}`)
    .join("\n");
  const solutionsBlock = findings.map((f) => `✓ ${f.improvement}`).join("\n");

  const subject = `${companyName}: ${n} ${n === 1 ? "area" : "aree"} da migliorare sulla vostra presenza online`;

  const body = `Buongiorno,

ho analizzato la presenza online di ${companyName}${scoreText} e ho notato alcuni punti che oggi vi stanno facendo perdere contatti e clienti:

${problemsBlock}

La buona notizia è che sono tutti risolvibili in tempi rapidi. Ecco come possiamo intervenire concretamente:

${solutionsBlock}

Il risultato: più visibilità, più richieste di preventivo e una presenza digitale che lavora per voi ogni giorno, non un costo fine a sé stesso.

Vi va se ci sentiamo 15 minuti? Vi mostro le priorità e una stima realistica di tempi e risultati, senza impegno.

Cordiali saluti,
Lorenzo Matarazzo
Online Station`;

  return { subject, body };
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
  const findings = (params.findings ?? []).filter((f) => f.problem?.trim()).slice(0, 3);
  if (findings.length > 0) {
    return buildStructuredSalesEmail({
      companyName,
      findings,
      overallScore: params.overallScore,
    });
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
