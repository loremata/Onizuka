// Fonte BASE: registroaziende.it — elenco comune + schede (Stato, P.IVA, ATECO…).
import * as cheerio from "cheerio";
import { fetchViaCurl, sleep } from "./fetch";
import { normName, normAddrStreet } from "./normalize";
import type { RegistroItem, StatoImpresa, ProgressFn } from "./types";

const BASE = "https://registroaziende.it";
const PAUSA_MS = 2500;
const JITTER_MS = 1500;
const STOP_DOPO_FALLIMENTI = 6;

const delay = () => sleep(PAUSA_MS + Math.floor(Math.random() * JITTER_MS));

function contaAziende(html: string): number {
  return (html.match(/\/azienda\//g) || []).length;
}

// Prova i candidati slug e ritorna il primo che restituisce un elenco popolato.
export async function risolviSlug(candidati: string[]): Promise<string | null> {
  for (const slug of candidati) {
    const { ok, html } = await fetchViaCurl(`${BASE}/comune/${slug}`);
    if (ok && contaAziende(html) > 3) return slug;
    await delay();
  }
  return null;
}

async function raccogliLink(slug: string, onProgress?: ProgressFn): Promise<{ href: string; nome: string }[]> {
  const links = new Map<string, string>();
  let pagina = 1;
  let vuote = 0;
  while (true) {
    const url = pagina === 1 ? `${BASE}/comune/${slug}` : `${BASE}/comune/${slug}?page=${pagina}`;
    const { ok, html } = await fetchViaCurl(url);
    if (!ok || !html) break;
    const $ = cheerio.load(html);
    let nuovi = 0;
    $('a[href^="/azienda/"]').each((_, el) => {
      const href = ($(el).attr("href") || "").split("?")[0];
      if (!href || href === "/azienda/") return;
      if (!links.has(href)) {
        links.set(href, $(el).text().trim());
        nuovi++;
      }
    });
    await onProgress?.({ phase: "registro:lista", current: links.size, note: `pagina ${pagina}` });
    if (nuovi === 0) {
      if (++vuote >= 2) break;
    } else vuote = 0;
    if (pagina > 300) break;
    pagina++;
    await delay();
  }
  return Array.from(links.entries()).map(([href, nome]) => ({ href, nome }));
}

function classificaStato(raw = ""): StatoImpresa {
  const s = raw.toLowerCase();
  if (s.includes("liquidazione")) return "in liquidazione";
  if (s.includes("cessat") || s.includes("cancellat") || s.includes("chiusa")) return "cessata";
  if (s.includes("falliment") || s.includes("concordato")) return "cessata";
  if (s.includes("inattiv") || s.includes("sospes")) return "inattiva";
  if (s.includes("attiv")) return "attiva";
  return "sconosciuto";
}

const PAYWALL = /accedi alla piattaforma/i;
const pulito = (v?: string) => (v && !PAYWALL.test(v) ? v.trim() : "");

function parseScheda(html: string, href: string, nomeLista: string): RegistroItem {
  const $ = cheerio.load(html);
  const m: Record<string, string> = {};
  $("th[scope=row]").each((_, th) => {
    const k = $(th).text().trim();
    m[k] = $(th).closest("tr").find("td").first().text().trim().replace(/\s+/g, " ");
  });

  const atecoPrim = pulito(m["Codice ATECO Primario"]) || pulito(m["Codice ATECO 2025"]) || "";
  const atecoCodice = (atecoPrim.match(/(\d{1,2}[.\d]*)/) || [])[1] || "";
  const atecoDesc = atecoPrim.replace(/^\s*\d{1,2}[.\d]*\s*[:\-]?\s*/, "").trim();
  const slugStato = href.includes("liquidazione") ? "in liquidazione" : href.includes("cessat") ? "cessata" : "";

  const ragione = pulito(m["Ragione sociale"]) || nomeLista;
  const citta = pulito(m["Città"]);
  return {
    nome: ragione,
    ragioneSociale: ragione,
    partitaIva: pulito(m["P.IVA"]),
    stato: classificaStato(m["Stato"] || slugStato),
    statoRaw: m["Stato"] || "",
    indirizzo: [pulito(m["Indirizzo"]), citta].filter(Boolean).join(", "),
    citta,
    provincia: pulito(m["Provincia"]),
    atecoCodice,
    atecoDescrizione: atecoDesc,
    atecoDivisione: atecoCodice.slice(0, 2),
    dipendenti: pulito(m["Dipendenti"]),
    urlScheda: BASE + href,
  };
}

// Opzioni per il resume: cache = schede già scaricate da un run precedente
// (vengono saltate nel loop); onCacheSave = persistenza incrementale della cache
// (chiamata ogni CACHE_OGNI schede nuove e prima di abortire per rate-limit).
const CACHE_OGNI = 25;

export interface ScrapeRegistroOptions {
  cache?: RegistroItem[];
  onCacheSave?: (items: RegistroItem[]) => Promise<void>;
}

// Pipeline registro: risolve lo slug, raccoglie i link, scarica le schede.
// Resumabile: con `cache` riparte dalle schede già fatte; con `onCacheSave`
// il chiamante persiste il lavoro parziale (anche in caso di errore fatale).
export async function scrapeRegistro(
  candidatiSlug: string[],
  onProgress?: ProgressFn,
  opzioni: ScrapeRegistroOptions = {}
): Promise<{ slug: string; items: RegistroItem[] }> {
  const slug = await risolviSlug(candidatiSlug);
  if (!slug) throw new Error("Comune non trovato su registroaziende (slug non risolto).");

  const lista = await raccogliLink(slug, onProgress);

  // Riparte dalla cache: le schede già scaricate non vengono ri-fetchate.
  const items: RegistroItem[] = [...(opzioni.cache ?? [])];
  const giaFatte = new Set(items.map((i) => i.urlScheda));

  // Best-effort: un errore nel salvataggio cache non deve rompere il crawl
  // (né mascherare l'errore originale quando salviamo prima di rilanciare).
  const salvaCache = async () => {
    try {
      await opzioni.onCacheSave?.(items);
    } catch {
      /* la cache è un'ottimizzazione: si prosegue comunque */
    }
  };

  let fatte = 0;
  let nuoveDaUltimoSalvataggio = 0;
  let fallimenti = 0;
  for (const row of lista) {
    // Scheda già in cache da un run precedente: conta come progresso e salta.
    if (giaFatte.has(BASE + row.href)) {
      fatte++;
      continue;
    }
    await delay();
    const { ok, html } = await fetchViaCurl(BASE + row.href);
    fatte++;
    if (!ok || !html) {
      if (++fallimenti >= STOP_DOPO_FALLIMENTI) {
        // Prima di abortire persisti il lavoro fatto: un retry del job riprenderà da qui.
        await salvaCache();
        throw new Error(`Registro: troppi errori consecutivi (rate-limit) dopo ${fatte} schede.`);
      }
      continue;
    }
    fallimenti = 0;
    items.push(parseScheda(html, row.href, row.nome));
    if (++nuoveDaUltimoSalvataggio >= CACHE_OGNI) {
      await salvaCache();
      nuoveDaUltimoSalvataggio = 0;
    }
    if (fatte % 10 === 0 || fatte === lista.length) {
      await onProgress?.({ phase: "registro", current: fatte, total: lista.length });
    }
  }
  return { slug, items };
}

// Chiavi derivate usate dal dedup (esportate per il resolver).
export function registroKeys(r: RegistroItem) {
  return { nameKey: normName(r.ragioneSociale || r.nome), addrKey: normAddrStreet(r.indirizzo) };
}
