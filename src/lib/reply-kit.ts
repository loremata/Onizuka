/**
 * KIT DI RISPOSTA — le tre risposte pronte per quando un prospect risponde.
 *
 * Nel B2B locale la velocità di risposta è il primo fattore di conversione:
 * chi risponde entro un'ora chiude molto più di chi risponde domani. Questo
 * kit arriva su Telegram insieme all'avviso "ha risposto", già personalizzato
 * e col link fresco al report: si copia, si adatta una riga, si invia.
 *
 * Tre scenari, che coprono la quasi totalità delle prime risposte:
 *  1. interessato / "sentiamoci"  → si fissa, non si spiega;
 *  2. "quanto costa?"             → niente cifre per iscritto (regola del
 *     26/08): si qualifica e si porta a voce;
 *  3. "chi siete?"                → il negozio fisico è la credenziale.
 */

export type ReplyKitParams = {
  /** Nome commerciale già pulito; vuoto se sconosciuto/segnaposto. */
  company?: string | null;
  /** Link al report PUBBLICO già rigenerato (token fresco), se disponibile. */
  reportUrl?: string | null;
};

function chi(company?: string | null): string {
  const c = (company ?? "").trim();
  return c ? c : "la vostra attività";
}

/** Le tre risposte, come testo unico pronto per Telegram (si copia a blocchi). */
export function buildReplyKit(params: ReplyKitParams): string {
  const azienda = chi(params.company);
  const report = params.reportUrl?.trim();
  const rigaReport = report
    ? `Le giro intanto l'analisi completa che avevamo preparato: ${report}`
    : "Le giro volentieri l'analisi completa che avevamo preparato.";

  return [
    "✍️ RISPOSTE PRONTE (copia · adatta · invia)",
    "",
    "1️⃣ SE È INTERESSATO:",
    `Buongiorno, grazie della risposta! ${rigaReport} Il modo più rapido per capire cosa conviene fare è sentirci due minuti: la chiamo io — mi dice quando le è comodo, oggi o domani? Oppure, se preferisce, ci trova in negozio sulla vecchia Aurelia a Rosignano. Lorenzo`,
    "",
    "2️⃣ SE CHIEDE IL PREZZO:",
    `Buongiorno, dipende da cosa serve davvero a ${azienda}: si va dal sito essenziale pronto in 24 ore al progetto su misura. Per darle una cifra seria e non un numero a caso mi servono due domande veloci — la chiamo io quando le è comodo? Così le porto anche l'analisi già fatta. Lorenzo`,
    "",
    "3️⃣ SE CHIEDE CHI SIAMO:",
    `Siamo Online Station: il negozio TIM e Fastweb in Via Vecchia Aurelia 393 a Rosignano Solvay — può passare a conoscerci quando vuole, dal lunedì al sabato. Oltre a telefonia e fibra seguiamo siti e presenza online delle attività della zona. ${rigaReport} Lorenzo`,
  ].join("\n");
}
