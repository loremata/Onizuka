/**
 * Dalle metriche misurate alle frasi della mail — con una regola sola:
 * **si può scrivere solo ciò che è stato misurato.**
 *
 * Prima di questo modulo la mail pescava da una tabella fissa di frasi per
 * sezione, senza mai guardare i dati raccolti. Il risultato era che 103 mail
 * dicevano «il sito riceve visite ma genera poche richieste» su aziende di cui
 * non conoscevamo né le visite né la velocità: 809 audit su 854 non hanno il
 * dato PageSpeed. È l'unica frase che un imprenditore può smentire con
 * certezza — «e tu come lo sai quante visite ho?» — e basta una volta per
 * bruciare il contatto.
 *
 * Qui ogni riga nasce da un campo di `metricsJson`. Se il campo manca, la riga
 * non esce: meglio una mail di due punti veri che di tre di cui uno inventato.
 */

import type { AuditFinding } from "@/lib/audit-service-recommendations";

/** Metriche raccolte dall'audit (forma di `DigitalAudit.metricsJson`). */
export interface AuditMetrics {
  hasWebsite?: boolean | null;
  siteReachable?: boolean | null;
  https?: boolean | null;
  responseMs?: number | null;
  mobileFriendly?: boolean | null;
  pagespeed?: { performance?: number | null } | number | null;
  seo?: {
    titleLength?: number | null;
    metaDescriptionLength?: number | null;
    h1Count?: number | null;
    structuredData?: string[] | null;
    hasSitemap?: boolean | null;
    hasCanonical?: boolean | null;
  } | null;
  tracking?: string[] | null;
  social?: string[] | null;
  contact?: { form?: boolean; phone?: boolean; whatsapp?: boolean; email?: boolean } | null;
  images?: { total?: number | null; withAlt?: number | null } | null;
  gbp?: {
    hasGbp?: boolean | null;
    rating?: number | null;
    reviewCount?: number | null;
    categories?: string[] | null;
    hasHours?: boolean | null;
    photoCount?: number | null;
  } | null;
}

/**
 * Domini che NON sono il sito dell'azienda: social, portali di prenotazione,
 * elenchi, aggregatori di recensioni. Trattarli come "sito aziendale" produce
 * due danni: si analizza la pagina sbagliata e si scrive al cliente che il suo
 * sito ha problemi che non sono suoi.
 *
 * Nel magazzino attuale sono 37 casi su 854, e il peggiore è un'azienda a cui
 * era stata attribuita la scheda Doctolib di un medico con un altro nome.
 */
const NON_SITI = [
  "facebook.com", "fb.com", "instagram.com", "linkedin.com", "twitter.com", "x.com",
  "tiktok.com", "youtube.com", "doctolib.it", "miodottore.it", "tripadvisor.",
  "thefork.it", "paginegialle.it", "virgilio.it", "cylex.it", "misterimprese.it",
  "prontoimprese.it", "europages.", "wixsite.com", "business.site", "wordpress.com",
  "blogspot.", "altervista.org", "jimdosite.com", "sitiwebs.com",
];

/** true se l'URL è un profilo su piattaforma altrui, non un sito aziendale. */
export function isNonSito(url?: string | null): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  return NON_SITI.some((d) => u.includes(d));
}

/** Etichetta leggibile della piattaforma, per dirlo al cliente senza tecnicismi. */
export function piattaformaDi(url?: string | null): string | null {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes("facebook.com") || u.includes("fb.com")) return "una pagina Facebook";
  if (u.includes("instagram.com")) return "un profilo Instagram";
  if (u.includes("linkedin.com")) return "una pagina LinkedIn";
  if (u.includes("doctolib") || u.includes("miodottore")) return "una scheda su un portale di prenotazioni";
  if (u.includes("tripadvisor") || u.includes("thefork")) return "una scheda su un portale di recensioni";
  if (u.includes("paginegialle") || u.includes("virgilio") || u.includes("cylex") || u.includes("misterimprese"))
    return "una scheda su un elenco aziende";
  if (isNonSito(url)) return "una pagina su una piattaforma di terzi";
  return null;
}

type Regola = {
  /** Vero solo se il dato ESISTE ed è negativo. Mai su un campo assente. */
  quando: (m: AuditMetrics) => boolean;
  /** La regola parla del sito: senza sito non ha senso dirla. Le metriche
   *  arrivano con `contact:{form:false,...}` e `tracking:[]` anche quando il
   *  sito non esiste, e senza questo filtro la mail direbbe «sul sito non c'è
   *  il modulo di contatto» a chi un sito non ce l'ha. */
  richiedeSito?: boolean;
  fatto: (m: AuditMetrics) => string;
  conseguenza: string;
  soluzione: string;
  /** Ordine di forza: prima le cose che il cliente riconosce subito. */
  peso: number;
};

const n = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const b = (x: unknown): x is boolean => typeof x === "boolean";

/**
 * Le regole. Ognuna cita un numero o un fatto che il destinatario può
 * verificare da solo in trenta secondi: è quello che distingue un'analisi da
 * una circolare.
 */
const REGOLE: Regola[] = [
  {
    peso: 100,
    richiedeSito: true,
    quando: (m) => b(m.siteReachable) && m.siteReachable === false,
    fatto: () => "il sito non risponde: provando ad aprirlo non si carica",
    conseguenza: "chi vi cerca trova una pagina di errore e va altrove",
    soluzione: "il ripristino del sito e un controllo continuo che resti raggiungibile",
  },
  {
    peso: 95,
    richiedeSito: true,
    quando: (m) => b(m.https) && m.https === false,
    fatto: () => "il sito non usa una connessione sicura (HTTPS)",
    conseguenza: "il browser mostra l'avviso «non sicuro» prima ancora che il visitatore legga",
    soluzione: "l'attivazione del certificato di sicurezza",
  },
  {
    peso: 90,
    richiedeSito: true,
    quando: (m) => !!m.contact && m.contact.form === false && m.contact.phone === false,
    fatto: () => "sul sito non c'è un modulo di contatto né un numero di telefono cliccabile",
    conseguenza: "chi vorrebbe scrivervi o chiamarvi deve cercare come farlo, e spesso rinuncia",
    soluzione: "l'inserimento di contatti immediati su ogni pagina",
  },
  {
    peso: 85,
    richiedeSito: true,
    quando: (m) => Array.isArray(m.tracking) && m.tracking.length === 0,
    fatto: () => "sul sito non è installato nessuno strumento di misurazione",
    conseguenza: "non è possibile sapere quante persone lo visitano, da dove arrivano e cosa fanno",
    soluzione: "un sistema chiaro per misurare i risultati",
  },
  {
    peso: 80,
    richiedeSito: true,
    quando: (m) => b(m.mobileFriendly) && m.mobileFriendly === false,
    fatto: () => "il sito non è adatto alla lettura da telefono",
    conseguenza: "oggi la maggior parte delle visite arriva da smartphone, e su quelle il sito è scomodo",
    soluzione: "il rifacimento delle pagine in versione mobile",
  },
  {
    peso: 75,
    quando: (m) => !!m.gbp && m.gbp.hasGbp === true && b(m.gbp.hasHours) && m.gbp.hasHours === false,
    fatto: () => "la vostra scheda Google non ha gli orari di apertura pubblicati",
    conseguenza: "chi cerca «aperto adesso» non vi vede comparire",
    soluzione: "la sistemazione della scheda Google dell'attività",
  },
  {
    peso: 72,
    quando: (m) => !!m.gbp && m.gbp.hasGbp === true && n(m.gbp.photoCount) && m.gbp.photoCount <= 3,
    fatto: (m) => {
      const p = m.gbp?.photoCount ?? 0;
      return p === 0
        ? "la vostra scheda Google non ha nemmeno una foto"
        : p === 1
          ? "la vostra scheda Google ha una sola foto"
          : `la vostra scheda Google ha solo ${p} foto`;
    },
    conseguenza: "le schede con più foto ricevono molte più richieste di indicazioni e chiamate",
    soluzione: "la sistemazione della scheda Google dell'attività",
  },
  {
    peso: 70,
    quando: (m) => !!m.gbp && m.gbp.hasGbp === true && n(m.gbp.reviewCount) && m.gbp.reviewCount <= 5,
    fatto: (m) => {
      const r = m.gbp?.reviewCount ?? 0;
      return r === 0
        ? "sulla vostra scheda Google non c'è nessuna recensione"
        : r === 1
          ? "sulla vostra scheda Google c'è una sola recensione"
          : `sulla vostra scheda Google ci sono ${r} recensioni`;
    },
    conseguenza: "chi deve scegliere si fida prima di chi ne ha di più, anche a parità di qualità",
    soluzione: "un metodo semplice per chiedere e raccogliere recensioni",
  },
  {
    peso: 65,
    richiedeSito: true,
    quando: (m) => !!m.seo && n(m.seo.metaDescriptionLength) && m.seo.metaDescriptionLength === 0,
    fatto: () => "le pagine non hanno la descrizione che Google mostra sotto il titolo nei risultati",
    conseguenza: "nei risultati di ricerca comparite con un testo scelto a caso, meno convincente",
    soluzione: "la scrittura di titoli e descrizioni per le pagine che contano",
  },
  {
    peso: 60,
    richiedeSito: true,
    quando: (m) => !!m.seo && n(m.seo.h1Count) && m.seo.h1Count === 0,
    fatto: () => "le pagine non hanno un titolo principale",
    conseguenza: "Google fatica a capire di cosa vi occupate e vi posiziona più in basso",
    soluzione: "la sistemazione della struttura delle pagine",
  },
  {
    peso: 55,
    richiedeSito: true,
    quando: (m) => !!m.seo && b(m.seo.hasSitemap) && m.seo.hasSitemap === false,
    fatto: () => "il sito non ha una mappa delle pagine per i motori di ricerca",
    conseguenza: "alcune pagine possono restare fuori dai risultati di Google",
    soluzione: "l'intervento tecnico per farvi indicizzare tutte le pagine",
  },
  {
    peso: 50,
    richiedeSito: true,
    quando: (m) => Array.isArray(m.social) && m.social.length === 0 && m.hasWebsite === true,
    fatto: () => "dal sito non risulta collegato nessun profilo social",
    conseguenza: "chi vi scopre online non ha modo di seguirvi e vi dimentica",
    soluzione: "un progetto di presenza social collegata al sito",
  },
  {
    peso: 45,
    richiedeSito: true,
    quando: (m) => !!m.images && n(m.images.total) && n(m.images.withAlt) && m.images.total > 0 && m.images.withAlt < m.images.total,
    fatto: (m) => {
      const tot = m.images?.total ?? 0;
      const senza = tot - (m.images?.withAlt ?? 0);
      return `${senza} immagini su ${tot} non hanno la descrizione testuale`;
    },
    conseguenza: "le immagini non compaiono nelle ricerche e il sito è meno accessibile",
    soluzione: "la sistemazione dei contenuti del sito",
  },
  {
    peso: 40,
    richiedeSito: true,
    quando: (m) => n(m.responseMs) && m.responseMs > 2000,
    fatto: (m) => `il sito impiega ${((m.responseMs ?? 0) / 1000).toFixed(1)} secondi a rispondere`,
    conseguenza: "oltre i due secondi una parte dei visitatori chiude prima di vedere la pagina",
    soluzione: "un intervento sulle prestazioni del sito",
  },
];

/**
 * Costruisce i punti della mail dalle metriche misurate.
 *
 * Restituisce meno di `max` righe — anche zero — quando i dati non bastano.
 * È voluto: se non abbiamo misurato niente di negativo e verificabile, non
 * c'è niente di onesto da scrivere, e la mail va impostata sul solo dato
 * certo (il sito assente, o la scheda Google).
 */
export function buildEvidenceFindings(metrics: AuditMetrics | null | undefined, max = 3): AuditFinding[] {
  if (!metrics) return [];
  const conSito = metrics.hasWebsite === true;
  return REGOLE.filter((r) => {
    if (r.richiedeSito && !conSito) return false;
    try {
      return r.quando(metrics);
    } catch {
      return false;
    }
  })
    .sort((a, b2) => b2.peso - a.peso)
    .slice(0, Math.max(0, max))
    .map((r) => ({ gap: r.fatto(metrics), consequence: r.conseguenza, solution: r.soluzione }));
}

/** Legge `metricsJson` senza far esplodere niente se la forma cambia. */
export function parseMetrics(raw: unknown): AuditMetrics | null {
  if (!raw) return null;
  try {
    const o = typeof raw === "string" ? JSON.parse(raw) : raw;
    return o && typeof o === "object" ? (o as AuditMetrics) : null;
  } catch {
    return null;
  }
}
