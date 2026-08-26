import { BRAND_PROPOSAL_TEMPLATES } from "@/lib/commercial-catalog-seed";
import type { AuditFinding } from "@/lib/audit-service-recommendations";
import { nomeCommerciale } from "@/lib/nome-commerciale";

/**
 * Firma completa, uguale su ogni prima mail: indirizzo fisico e due numeri
 * veri sono la prova di esistenza che nessuno spammer si sogna di mettere —
 * e aprono il canale telefono senza bisogno di link.
 */
const FIRMA = `Cordiali saluti,
Lorenzo Matarazzo
Online Station · Via Vecchia Aurelia 393, Rosignano Solvay
Tel. 0586 017371 · WhatsApp 327 377 7737 · onlinestation.it`;

/** Rotazione deterministica: stessa azienda → stesso oggetto, sempre. */
function ruota(companyName: string, n: number): number {
  let h = 0;
  for (const c of companyName) h = (h + c.charCodeAt(0)) % 997;
  return h % n;
}

/**
 * Email diretta orientata alla vendita, linguaggio semplice e senza brand interni:
 * abbiamo analizzato → queste lacune generano questi problemi → le risolviamo con queste soluzioni
 * → CTA decisa verso consulenza gratuita (con report già pronto da condividere).
 */
function buildStructuredSalesEmail(params: {
  companyName: string;
  findings: AuditFinding[];
  hasWebsite?: boolean;
  /** Se l'unica presenza trovata è su una piattaforma di terzi (pagina
   *  Facebook, scheda su un portale): va detto, non spacciato per sito. */
  piattaformaTerzi?: string | null;
  gbpReviewCount?: number | null;
  gbpRating?: number | null;
}): { subject: string; subjectAlt?: string; body: string } {
  const { companyName, findings } = params;
  const n = findings.length;

  const gapsBlock = findings
    .map((f) => `• ${capitalize(f.gap)}: ${f.consequence}.`)
    .join("\n");
  // Due problemi diversi possono avere la stessa soluzione (orari e foto si
  // sistemano entrambi sulla scheda Google): elencarla due volte fa sembrare
  // il testo generato male.
  const solutionsBlock = Array.from(new Set(findings.map((f) => capitalize(f.solution))))
    .map((s) => `✓ ${s}`)
    .join("\n");

  // Chi sono e perché scrivo, PRIMA del cosa: per un'attività locale «sono di
  // zona» è metà della fiducia — e spiega come mai ho guardato proprio loro.
  const identita =
    "sono Lorenzo di Online Station, a Rosignano Solvay: seguiamo la presenza online delle attività della zona.";

  // Apertura sul segnale più forte e concreto (= più credibile del generico "abbiamo analizzato").
  const opener =
    params.piattaformaTerzi
      ? `Cercando online ${companyName} ho trovato ${params.piattaformaTerzi}, ma non un sito vostro: chi vi cerca oggi vede una presenza che non controllate e che non porta a voi.`
      : params.hasWebsite === false
        ? `Cercando online ${companyName} non ho trovato un sito web attivo: chi vi cerca oggi su Google rischia di non trovarvi — o di trovare prima un concorrente.`
        : `Ho dato un'occhiata a come appare ${companyName} a chi la cerca su Google, e ho preparato un report con le aree su cui potete crescere.`;

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

  // Oggetto principale a ROTAZIONE (nei paesi piccoli i titolari si parlano:
  // due mail identiche mostrate al bar = lettera in serie) + variante A/B
  // (loss-framing) per testare la resa. Con zero punti verificabili niente
  // conteggi in oggetto: «0 aree da sistemare» si squalifica da sola.
  const generico = companyName === "la vostra azienda";
  let subject: string;
  if (params.piattaformaTerzi) {
    subject = `${companyName}: online vi rappresenta una pagina che non è vostra`;
  } else if (params.hasWebsite === false) {
    subject = generico
      ? "Chi vi cerca su Google non trova il vostro sito"
      : `${companyName}: chi vi cerca su Google non trova il vostro sito`;
  } else if (n === 0) {
    subject = generico
      ? "Ho dato un'occhiata alla vostra presenza online"
      : `Ho dato un'occhiata alla presenza online di ${companyName}`;
  } else {
    const varianti = generico
      ? [
          `${n} ${n === 1 ? "cosa" : "cose"} da sistemare nella vostra presenza online`,
          "Ho dato un'occhiata alla vostra presenza online",
          `La vostra attività su Google: ${n} ${n === 1 ? "punto che merita" : "punti che meritano"} attenzione`,
        ]
      : [
          `${companyName}: ${n} ${n === 1 ? "cosa" : "cose"} da sistemare nella vostra presenza online`,
          `Ho dato un'occhiata alla presenza online di ${companyName}`,
          `${companyName} su Google: ${n} ${n === 1 ? "punto che merita" : "punti che meritano"} attenzione`,
        ];
    subject = varianti[ruota(companyName, varianti.length)];
  }
  const subjectAlt =
    n > 0 ? `${companyName}: ${n} ${n === 1 ? "area" : "aree"} che oggi vi fanno perdere clienti` : undefined;

  // Con zero punti verificabili l'elenco non si scrive: la mail resta sul dato
  // certo dell'apertura (sito assente, pagina di terzi, scheda Google) e passa
  // direttamente al report. Meglio corta e vera che lunga e riempita.
  const blocco =
    n === 0
      ? ""
      : `
Guardando più nel dettaglio, questi sono i punti che oggi vi fanno perdere clienti:

${gapsBlock}

Sono tutte situazioni che sappiamo risolvere. In concreto:

${solutionsBlock}
`;

  const body = `Buongiorno,

${identita} ${opener}
${gbpLine ? `\n${gbpLine}\n` : ""}${blocco}

Il report completo della vostra presenza online è già pronto: basta rispondere a questa mail e saremo lieti di mostrarvelo — con le priorità e i risultati ottenibili, senza impegno.

${FIRMA}`
    // Righe vuote doppie quando un blocco è assente: cosmetico, ma nei client
    // di posta si vede. Mai più di una riga vuota di fila.
    .replace(/\n{3,}/g, "\n\n");
  // Niente link nel corpo (decisione 26/08): i token dei report scadono a 30
  // giorni — i primi destinatari cliccavano su "report scaduto" — e ogni link
  // in una mail a freddo pesa sulla deliverability. Il report diventa il
  // motivo per RISPONDERE: lo si mostra a chi risponde, non lo si allega.

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
  piattaformaTerzi?: string | null;
  gbpReviewCount?: number | null;
  gbpRating?: number | null;
}): { subject: string; body: string; subjectAlt?: string } {
  // Il nome arriva dalla visura camerale: va ripulito prima di finire in un
  // oggetto mail, altrimenti si legge «Az.Agr.Marchi E Barsotti Societa'
  // Sempliice Societa' Agricola» e il destinatario capisce, prima ancora di
  // leggere il contenuto, che dall'altra parte non c'è nessuno.
  const nc = nomeCommerciale(params.companyName);
  const companyName = nc.nome || "la vostra azienda";

  // Percorso principale: email costruita sui fatti misurati dall'audit.
  //
  // Ci si passa anche con ZERO punti verificabili, purché ci sia un aggancio
  // vero — sito assente, pagina di terzi, scheda Google. Il report non viaggia
  // più come link (scade a 30 giorni e pesa sulla deliverability): è l'esca
  // per la risposta, quindi basta l'aggancio.
  const findings = (params.findings ?? []).filter((f) => f.gap?.trim() && f.solution?.trim()).slice(0, 3);
  const agganciaDatoCerto =
    !!params.piattaformaTerzi || params.hasWebsite === false || typeof params.gbpReviewCount === "number";
  if (findings.length > 0 || agganciaDatoCerto) {
    return buildStructuredSalesEmail({
      companyName,
      findings,
      hasWebsite: params.hasWebsite,
      piattaformaTerzi: params.piattaformaTerzi,
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
      body: `${bodyBase}${scoreNote}\n\nSe vi va, possiamo confrontarci in una breve call questa settimana.\n\n${FIRMA}`,
    };
  }

  return {
    subject: `Opportunità digitale per ${companyName}`,
    body: `Buongiorno,

ho dato un'occhiata alla presenza digitale di ${companyName}${
      params.overallScore != null ? ` (sintesi audit: ${params.overallScore}/100)` : ""
    }.

Emergono margini concreti su ${problem.toLowerCase()}.

Un intervento su ${offer} può portare risultati concreti e misurabili.

Se vi va, possiamo confrontarci in una breve call questa settimana.

${FIRMA}`,
  };
}
