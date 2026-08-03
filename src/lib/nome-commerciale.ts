/**
 * Dalla ragione sociale al nome con cui l'azienda si chiama davvero.
 *
 * I nomi arrivano dalla visura camerale e sono scritti per il registro
 * imprese, non per una mail: «Az.Agr.Marchi E Barsotti Societa' Sempliice
 * Societa' Agricola», «Ristorante La Pineta Di Andrea E Daniele Zazzeri Snc»,
 * «La Crisalide S.N.C. Di Creatini Simona E Pucini Lisa.». Scrivere
 * «ho analizzato la presenza online di Az.Agr.Marchi E Barsotti Societa'
 * Sempliice Societa' Agricola» dichiara al destinatario, prima ancora che
 * legga il contenuto, che dall'altra parte non c'è nessuno.
 *
 * Qui si tolgono le forme giuridiche, si sciolgono le abbreviazioni e si taglia
 * la parte anagrafica dopo «Di», che è il titolare e non l'insegna.
 *
 * Caso a parte: quando la ragione sociale è solo il nome di una persona
 * («Gentili Giuseppe») non esiste un'insegna da usare, e va scritto in un
 * altro modo — per questo la funzione lo dichiara invece di indovinare.
 */

/** Forme giuridiche e diciture da togliere, dalla più lunga alla più corta. */
const FORME = [
  // Le visure scrivono l'apostrofo in modo incoerente: "Societa'", "Società",
  // "Responsabilita'", "Responsabilita". Vanno elencate tutte le combinazioni
  // che si incontrano davvero, altrimenti resta in cima alla mail
  // "La Fenice Societa' a Responsabilita' Limitata Semplificata".
  "societa' a responsabilita' limitata semplificata",
  "societa' a responsabilita limitata semplificata",
  "società a responsabilità limitata semplificata",
  "societa a responsabilita limitata semplificata",
  "societa' a responsabilita' limitata",
  "societa' a responsabilita limitata",
  "società a responsabilità limitata",
  "societa a responsabilita limitata",
  "societa' cooperativa agricola", "società cooperativa agricola",
  "societa' cooperativa", "società cooperativa",
  "societa' in nome collettivo", "società in nome collettivo",
  "societa' in accomandita semplice", "società in accomandita semplice",
  "unipersonale",
  "societa' semplice agricola", "società semplice agricola",
  "societa' agricola", "società agricola", "societa agricola",
  "societa' semplice", "società semplice", "societa semplice",
  "societa' sempliice", // refuso presente in visura
  "s.a.s.", "s.n.c.", "s.r.l.s.", "s.r.l.", "s.p.a.",
  "sas", "snc", "srls", "srl", "spa",
  "& c.", "e c.", "& figli", "e figli",
  "di s.s.", "s.s.",
];

/** Abbreviazioni camerali da sciogliere. */
const ABBREVIAZIONI: [RegExp, string][] = [
  // L'ordine conta: "Az. Agricola" va sciolto PRIMA di "Az. Agr.", altrimenti
  // il secondo pattern morde dentro la parola e lascia "Azienda Agricolaicola".
  [/\baz\.?\s*agricola\b/gi, "Azienda Agricola"],
  [/\baz\.\s*agr\.?/gi, "Azienda Agricola"],
  [/\bimm\.re\b/gi, "Immobiliare"],
  [/\bf\.lli\b/gi, "Fratelli"],
];

/** Parole che restano minuscole quando stanno in mezzo. */
const MINUSCOLE = new Set(["di", "de", "del", "della", "dei", "degli", "delle", "e", "ed", "da", "in", "il", "la", "lo", "le", "i", "gli", "a", "al", "con", "su", "per", "tra", "fra", "d'"]);

/** Segnali che la stringa è un'insegna e non un nome di persona. */
const SEGNALI_INSEGNA = /\b(ristorante|bar|hotel|albergo|pizzeria|osteria|trattoria|azienda|agricola|impianti|autofficina|officina|studio|farmacia|immobiliare|costruzioni|edilizia|termoidraulica|elettric|idraulic|parrucch|estetic|gelateria|panificio|macelleria|forno|caffe|caffè|pub|birreria|agriturismo|cantina|frantoio|vivaio|garden|centro|clinica|laboratorio|tipografia|carrozzeria|gommista|concessionaria|supermercat|alimentari|boutique|abbigliamento|calzature|gioielleria|ottica|libreria|cartoleria|ferramenta|colorificio|arredamenti|falegnameria|serramenti|piscine|impresa|servizi|consulenza|assicuraz|agenzia|viaggi|trasporti|autotrasporti|logistica|pulizie|giardinaggio|lavanderia|tintoria|noleggio|informatic|software|comunicazione|pubblicit|stampa|fotografi|palestra|piscina|scuola|asilo|residence|camping|stabilimento|lido|spiaggia)\b/i;

function pulisciSpazi(s: string): string {
  return s.replace(/\s+/g, " ").replace(/\s+([,.;])/g, "$1").trim();
}

/** Toglie la punteggiatura finale, ma non il punto di una sigla (D.M.C.). */
function tagliaCodaSalvandoSigle(s: string): string {
  const pulito = pulisciSpazi(s).replace(/[,;\s]+$/, "");
  const ultima = pulito.split(" ").pop() ?? "";
  if (/^[A-Za-z](\.[A-Za-z])+\.?$/.test(ultima)) return pulito;
  return pulito.replace(/[.\s]+$/, "");
}

function capitalizzaBene(s: string): string {
  const parole = s.split(" ");
  return parole
    .map((p, i) => {
      const basso = p.toLowerCase();
      if (i > 0 && MINUSCOLE.has(basso)) return basso;
      // Qualunque token con un punto dentro è una sigla o un nome proprio
      // abbreviato (D.M.C., Gris.Ot): si lascia esattamente com'è scritto.
      if (p.includes(".")) return p;
      return basso.charAt(0).toUpperCase() + basso.slice(1);
    })
    .join(" ");
}

export interface NomeCommerciale {
  /** Il nome da usare nel testo. */
  nome: string;
  /** true quando la ragione sociale è solo il nome del titolare: non c'è
   *  un'insegna, e la mail deve girare la frase invece di usarlo come marchio. */
  isPersona: boolean;
}

export function nomeCommerciale(raw?: string | null): NomeCommerciale {
  const originale = (raw ?? "").trim();
  if (!originale) return { nome: "", isPersona: false };

  // Lo spazio dopo la sostituzione è necessario: nelle visure l'abbreviazione
  // è spesso attaccata al nome ("Az.Agr.Marchi"), e senza spazio uscirebbe
  // "Azienda Agricolamarchi".
  let s = originale;
  for (const [re, sost] of ABBREVIAZIONI) s = s.replace(re, `${sost} `);

  // via le forme giuridiche, ovunque si trovino
  let basso = s.toLowerCase();
  for (const f of FORME) {
    let i = basso.indexOf(f);
    while (i !== -1) {
      s = s.slice(0, i) + " " + s.slice(i + f.length);
      basso = s.toLowerCase();
      i = basso.indexOf(f);
    }
  }
  s = tagliaCodaSalvandoSigle(s);

  // «Insegna Di Titolare» → tengo l'insegna, ma solo se resta qualcosa di
  // sensato. Se davanti a «Di» c'è solo un descrittore generico ("Azienda
  // Agricola Di Francesco Sesto") tagliare produce un nome che non identifica
  // nessuno: meglio tenere tutto e lasciar decidere alla mail.
  const m = s.match(/^(.{3,}?)\s+[Dd][Ii]\s+(.+)$/);
  if (m) {
    const prima = pulisciSpazi(m[1]).replace(/[,;]+$/, "");
    const paroleP = prima.split(" ").filter(Boolean);
    const soloGenerico = /^(azienda agricola|azienda|ditta|impresa|societa'?|società|studio)$/i.test(prima.trim());
    const sembraInsegna = SEGNALI_INSEGNA.test(prima) || paroleP.length >= 2 || prima.length >= 4;
    if (sembraInsegna && !soloGenerico && prima.length >= 3) s = prima;
  }

  s = tagliaCodaSalvandoSigle(s);
  let nome = capitalizzaBene(s);

  // Rete di sicurezza: se ripulire ha lasciato un moncone ("C & C. S.R.L." →
  // "C") il nome non identifica più nessuno. Meglio la ragione sociale intera,
  // brutta ma corretta, che una lettera sola in cima a una mail.
  if (nome.replace(/[^A-Za-zÀ-ÿ0-9]/g, "").length < 3) nome = pulisciSpazi(originale);

  // Persona fisica: poche parole e nessun segnale di insegna. Un articolo
  // iniziale ("La Crisalide", "Il Rifrullo"), una & o una sigla dicono che è
  // un'insegna anche quando non compare una parola di settore.
  const parole = nome.split(" ").filter(Boolean);
  const articoloIniziale = /^(il|lo|la|le|i|gli|l'|un|una|da)\b/i.test(nome);
  const haSigla = parole.some((p) => p.includes("."));
  const isPersona =
    parole.length <= 3 &&
    !SEGNALI_INSEGNA.test(nome) &&
    !articoloIniziale &&
    !haSigla &&
    !nome.includes("&") &&
    !/\d/.test(nome);

  return { nome: nome || originale, isPersona };
}
