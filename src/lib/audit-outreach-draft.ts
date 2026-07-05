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
  hasWebsite?: boolean;
  gbpReviewCount?: number | null;
  gbpRating?: number | null;
}): { subject: string; subjectAlt: string; body: string } {
  const { companyName, findings } = params;
  const n = findings.length;

  const gapsBlock = findings
    .map((f) => `• ${capitalize(f.gap)}: ${f.consequence}.`)
    .join("\n");
  const solutionsBlock = findings.map((f) => `✓ ${capitalize(f.solution)}`).join("\n");

  // Apertura sul segnale più forte e concreto (= più credibile del generico "abbiamo analizzato").
  const opener =
    params.hasWebsite === false
      ? `cercando online ${companyName} non ho trovato un sito web attivo: chi vi cerca oggi su Google rischia di non trovarvi — o di trovare prima un concorrente.`
      : `ho analizzato la presenza online di ${companyName} e preparato un report dettagliato con le aree su cui potete crescere.`;

  // Riferimento concreto al profilo Google, quando disponibile: dimostra che ho guardato davvero.
  let gbpLine = "";
  if (typeof params.gbpReviewCount === "number") {
    gbpLine =
      params.gbpReviewCount <= 1
        ? "Ho anche notato che il profilo Google dell'attività ha pochissime recensioni: è un'occasione persa, perché in zona chi sceglie si fida prima di chi ne ha di più."
        : `Ho visto che il vostro profilo Google ha ${params.gbpReviewCount} recensioni${
            typeof params.gbpRating === "number" ? ` (${params.gbpRating}/5)` : ""
          }: una buona base, su cui però si può costruire molto di più.`;
  }

  // Oggetto principale (benefit/curiosità) + variante A/B (loss-framing) per testare l'open rate.
  const subject =
    params.hasWebsite === false
      ? `${companyName}: chi vi cerca su Google non trova il vostro sito`
      : `${companyName}: ${n} ${n === 1 ? "area" : "aree"} da sistemare nella vostra presenza online`;
  const subjectAlt = `${companyName}: ${n} ${n === 1 ? "area" : "aree"} che oggi vi fanno perdere clienti`;

  const body = `Buongiorno,

${opener}
${gbpLine ? `\n${gbpLine}\n` : ""}
Guardando più nel dettaglio, questi sono i punti che oggi vi fanno perdere clienti:

${gapsBlock}

Sono tutte situazioni che sappiamo risolvere. In concreto:

${solutionsBlock}

Ho già pronto il report completo della vostra presenza online: se vi va ve lo illustro in una consulenza gratuita, in call o di persona, con priorità e risultati ottenibili, dati alla mano.

Mi basta un vostro cenno con un paio di slot comodi tra questa e la prossima settimana e organizzo io l'incontro.

Cordiali saluti,
Lorenzo Matarazzo
Online Station`;

  return { subject, subjectAlt, body };
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
  hasWebsite?: boolean;
  gbpReviewCount?: number | null;
  gbpRating?: number | null;
}): { subject: string; body: string; subjectAlt?: string } {
  const companyName = params.companyName.trim() || "la vostra azienda";

  // Percorso principale: email personalizzata sui problemi reali emersi dall'audit.
  const findings = (params.findings ?? []).filter((f) => f.gap?.trim() && f.solution?.trim()).slice(0, 3);
  if (findings.length > 0) {
    return buildStructuredSalesEmail({
      companyName,
      findings,
      hasWebsite: params.hasWebsite,
      gbpReviewCount: params.gbpReviewCount,
      gbpRating: params.gbpRating,
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
