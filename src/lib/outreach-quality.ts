/**
 * Guardia di qualità sul testo di una mail di outreach, PRIMA che parta.
 *
 * Nasce da difetti realmente arrivati fino alla coda di invio: placeholder mai
 * sostituiti (`[nome]`), interpolazioni andate a vuoto (`undefined`), punteggi
 * assenti stampati come `0/100`, ragioni sociali grezze da visura che
 * dichiarano l'automatismo prima ancora che il testo venga letto.
 *
 * Il principio è lo stesso di `audit-evidence.ts`: quello che esce deve
 * reggere la lettura di un destinatario che non ci conosce. Un difetto di
 * questo elenco non è un dettaglio estetico — è la prova visibile che dietro
 * c'è un automatismo, e brucia il contatto.
 */

export type OutreachQualityProblem = {
  /** Codice stabile, utile in log e test. */
  code: string;
  /** Messaggio leggibile, mostrato a chi tenta l'invio. */
  message: string;
};

export type OutreachQualityResult = {
  ok: boolean;
  problems: OutreachQualityProblem[];
};

/** Sotto questa soglia il corpo non può contenere un messaggio sensato. */
const MIN_BODY_CHARS = 120;

/**
 * Forme giuridiche che devono essere già state ripulite da `nome-commerciale.ts`.
 * Se compaiono nel testo, il nome è arrivato grezzo dalla visura.
 */
// NB: le varianti con apostrofo non possono avere `\b` finale — dopo `'` il
// confine di parola non scatta, ed era esattamente il caso «Societa'» da visura.
const FORME_GIURIDICHE =
  /(\b(s\.?r\.?l\.?s?|s\.?p\.?a|s\.?n\.?c|s\.?a\.?s|soc\.\s*coop|s\.?s\.?d|unipersonale|impresa individuale)\b|\bsociet(a'|à)|\bresponsabilit(a'|à))/i;

/** Placeholder tipici lasciati indietro: [nome], {{azienda}}, {nome}, <NOME>. */
const PLACEHOLDER_QUADRE = /\[[a-z_ ]{2,30}\]/i;
const PLACEHOLDER_GRAFFE = /\{\{?\s*[a-z_.]{2,40}\s*\}?\}/i;

/** Interpolazioni fallite finite nel testo. */
const VALORE_MANCANTE = /\b(undefined|null|NaN|\[object Object\])\b/;

/** Punteggio assente stampato come zero (`0/100`, `0 / 100`). */
const PUNTEGGIO_ZERO = /\b0\s*\/\s*100\b/;

/** Link al report troncato: `/report/` senza token, o token troppo corto. */
const REPORT_TRONCO = /\/report\/(?![A-Za-z0-9_-]{16,})/;

/** Doppi spazi o righe di soli separatori: segno di blocchi rimossi male. */
const SEGMENTO_VUOTO = /(^|\n)\s*[-–—•]\s*(\n|$)/;

function add(problems: OutreachQualityProblem[], code: string, message: string) {
  if (!problems.some((p) => p.code === code)) problems.push({ code, message });
}

/**
 * Controlla oggetto e corpo di una bozza. Non guarda il destinatario né il
 * consenso: quelli restano compito di `outreach-send.ts`. Qui si giudica
 * soltanto se il TESTO è presentabile.
 */
export function validateOutreachDraft(input: {
  subject?: string | null;
  body?: string | null;
}): OutreachQualityResult {
  const problems: OutreachQualityProblem[] = [];
  const subject = (input.subject ?? "").trim();
  const body = (input.body ?? "").trim();

  if (!subject) {
    add(problems, "subject_vuoto", "L'oggetto è vuoto.");
  }
  if (!body) {
    add(problems, "body_vuoto", "Il corpo della mail è vuoto.");
  } else if (body.length < MIN_BODY_CHARS) {
    add(
      problems,
      "body_troppo_corto",
      `Il corpo è di ${body.length} caratteri: troppo poco per un messaggio sensato (minimo ${MIN_BODY_CHARS}).`
    );
  }

  const testo = `${subject}\n${body}`;

  if (PLACEHOLDER_QUADRE.test(testo) || PLACEHOLDER_GRAFFE.test(testo)) {
    add(
      problems,
      "placeholder_residuo",
      "C'è un segnaposto non sostituito (es. [nome] o {{azienda}})."
    );
  }
  if (VALORE_MANCANTE.test(testo)) {
    add(
      problems,
      "valore_mancante",
      "Nel testo compare un valore non calcolato (undefined/null/NaN)."
    );
  }
  if (PUNTEGGIO_ZERO.test(testo)) {
    add(
      problems,
      "punteggio_zero",
      "Il testo dichiara un punteggio 0/100: di norma significa che il punteggio non è stato misurato."
    );
  }
  if (FORME_GIURIDICHE.test(testo)) {
    add(
      problems,
      "ragione_sociale_grezza",
      "Compare la forma giuridica (S.r.l., Snc, Società…): il nome non è passato da nomeCommerciale()."
    );
  }
  if (REPORT_TRONCO.test(body)) {
    add(problems, "link_report_tronco", "Il link al report è incompleto: manca il token.");
  }
  if (SEGMENTO_VUOTO.test(body)) {
    add(problems, "elenco_vuoto", "C'è una voce di elenco senza contenuto.");
  }

  return { ok: problems.length === 0, problems };
}

/** Riassunto in una riga, per note di invio e log. */
export function describeOutreachQuality(result: OutreachQualityResult): string {
  if (result.ok) return "Testo verificato.";
  return result.problems.map((p) => p.message).join(" ");
}
