// Worker di scraping — gira su GitHub Actions (o sul PC come fallback), NON su Vercel
// (registroaziende blocca il TLS di Node → serve curl; e lo scraping supera il limite
// 5 min delle funzioni serverless). Polla i ScrapeJob in coda, esegue registro →
// Places → dedup → import Lead, aggiornando progresso e contatori sul job.
// La fase registro è RESUMABILE: le schede scaricate vengono persistite in
// registroCacheJson (ogni 25 + prima di un abort per rate-limit); un job in
// ERROR rimesso in coda (bottone "Riprova" nella UI) riprende da lì.
//
// Avvio PC (loop continuo):  npx tsx scripts/scraper-worker.ts   (o il file .bat)
// Avvio CI (single-pass):    WORKER_ONCE=1 tsx scripts/scraper-worker.ts
//   → drena tutti i job QUEUED e poi ESCE (non resta in polling).
// Env: DATABASE_URL (Supabase) + GOOGLE_PLACES_API_KEY (da .env.worker in locale,
//      oppure dai secret dell'ambiente su GitHub Actions).
import { loadDotEnvFiles, loadEnvFile } from "./load-dotenv.mjs";
loadDotEnvFiles();
// Override dedicato al worker (es. DATABASE_URL di PRODUZIONE + GOOGLE_PLACES_API_KEY),
// tenuto separato da .env/.env.local usati dal dev. Opzionale: se non c'è (es. su CI),
// si usano le env già presenti nel processo (secret Actions).
loadEnvFile(process.cwd(), ".env.worker", { override: true });

// Single-pass: su GitHub Actions vogliamo drenare la coda e uscire, non pollare all'infinito.
const ONCE = process.env.WORKER_ONCE === "1";
// Tetto di durata (minuti): il runner GitHub viene ucciso al timeout del job e un
// crawl grosso (Rosignano, Cecina: >1500 schede a ~4s l'una) non ci sta in una sola
// esecuzione. Con il tetto il worker si ferma PRIMA, salva la cache e rimette il job
// in coda: la ripresa riparte dalle schede già scaricate. 0 = nessun tetto (uso da PC).
const MAX_MINUTES = Number(process.env.WORKER_MAX_MINUTES) || 0;
const POLL_MS = 5000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mask = (u?: string) => (u ? u.replace(/:[^:@]+@/, ":***@") : "(mancante)");

async function main() {
  // Import dinamici DOPO il caricamento env (Prisma legge DATABASE_URL all'istanza).
  const { prisma } = await import("@/lib/prisma");
  const { registroSlugCandidates } = await import("@/lib/scraping/registro-slug");
  const { scrapeRegistro, ERRORE_SCADENZA } = await import("@/lib/scraping/registro");
  const { scrapePlaces } = await import("@/lib/scraping/places");
  const { resolveCompanies } = await import("@/lib/scraping/resolve");
  const { importScrapedCompanies } = await import("@/lib/scraping/import-leads");
  const { PROVINCE_ITALIA } = await import("@/lib/scraping/comuni-italia");
  type ProgressArg = { phase: string; current?: number; total?: number; note?: string };
  type RegistroItem = import("@/lib/scraping/types").RegistroItem;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY || "";
  const scadenza = MAX_MINUTES ? Date.now() + MAX_MINUTES * 60_000 : Infinity;
  const scaduto = () => Date.now() >= scadenza;
  console.log(`[worker] avviato. DB: ${mask(process.env.DATABASE_URL)} · Places key: ${apiKey ? "presente" : "ASSENTE"}`);
  if (MAX_MINUTES) console.log(`[worker] tetto di durata: ${MAX_MINUTES} min (poi rimette in coda e esce).`);
  if (!apiKey) console.log("[worker] ⚠️  senza GOOGLE_PLACES_API_KEY l'arricchimento Google sarà saltato.");

  for (;;) {
    // Tetto di durata raggiunto: non si prende un nuovo job (quello in corso è già
    // stato rimesso in coda dal ramo di scadenza qui sotto).
    if (scaduto()) {
      console.log("[worker] tetto di durata raggiunto — esco: i job in coda ripartono al prossimo giro.");
      break;
    }

    // Claim di un job in coda (worker singolo: findFirst + update).
    const next = await prisma.scrapeJob.findFirst({
      where: { status: "QUEUED" },
      orderBy: { createdAt: "asc" },
    });
    if (!next) {
      if (ONCE) {
        console.log("[worker] nessun job in coda — esco (WORKER_ONCE).");
        break;
      }
      await sleep(POLL_MS);
      continue;
    }

    const job = await prisma.scrapeJob.update({
      where: { id: next.id },
      data: { status: "RUNNING", startedAt: new Date(), heartbeatAt: new Date(), phase: "registro" },
    });
    console.log(`[worker] job ${job.id} → ${job.comune} (${job.provincia})`);

    const onProgress = async (p: ProgressArg) => {
      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: {
          phase: p.phase,
          progressCurrent: p.current ?? 0,
          progressTotal: p.total ?? 0,
          heartbeatAt: new Date(),
        },
      });
    };

    // Cache incrementale del crawl registro (resume): se il job era già fallito
    // a metà, riparte dalle schede già scaricate invece che da zero.
    let cacheRegistro: RegistroItem[] = [];
    if (job.registroCacheJson) {
      try {
        cacheRegistro = JSON.parse(job.registroCacheJson) as RegistroItem[];
        console.log(`[worker] job ${job.id} → riprendo da ${cacheRegistro.length} schede già in cache`);
      } catch {
        cacheRegistro = []; // cache corrotta: si riparte da zero
      }
    }
    // Persiste il lavoro parziale sul job: chiamata da scrapeRegistro ogni 25
    // schede nuove e comunque prima di un abort per rate-limit.
    const salvaCacheRegistro = async (items: RegistroItem[]) => {
      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: { registroCacheJson: JSON.stringify(items), heartbeatAt: new Date() },
      });
    };

    try {
      // 1) Registro (base): stato, P.IVA, ATECO.
      const candidati = registroSlugCandidates(job.comune, job.provincia);
      const { items: registro } = await scrapeRegistro(candidati, onProgress, {
        cache: cacheRegistro,
        onCacheSave: salvaCacheRegistro,
        shouldStop: scaduto,
      });
      const active = registro.filter((r) => r.stato === "attiva").length;
      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: {
          totalFound: registro.length,
          activeCount: active,
          excludedCount: registro.length - active,
          // Fase registro completata: la cache non serve più (peso morto sul DB).
          registroCacheJson: null,
        },
      });

      // 2) Places (arricchimento): sito, telefono, recensioni.
      const sigla = PROVINCE_ITALIA.find((p) => p.nome === job.provincia)?.sigla || "";
      const places = apiKey ? await scrapePlaces(apiKey, job.comune, sigla, onProgress) : [];

      // 3) Dedup / entity resolution.
      await onProgress({ phase: "merge" });
      const resolved = resolveCompanies(registro, places, job.comune);
      const enriched = resolved.filter((r) => r.fonti.includes("registro") && r.fonti.includes("places")).length;
      await prisma.scrapeJob.update({ where: { id: job.id }, data: { placesEnriched: enriched } });

      // 4) Import Lead (solo attive, dedup contro il CRM).
      const result = await importScrapedCompanies(
        { ownerUserId: job.ownerUserId, comune: job.comune, companies: resolved },
        onProgress
      );

      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: {
          status: "DONE",
          phase: "done",
          leadsCreated: result.created,
          dedupSkipped: result.skippedExisting,
          finishedAt: new Date(),
          heartbeatAt: new Date(),
        },
      });
      console.log(`[worker] job ${job.id} DONE · lead creati ${result.created} · saltati ${result.skippedExisting}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      // Interruzione per tetto di durata: NON è un fallimento. Il job torna in coda
      // con la cache del crawl già salvata e riprende al giro successivo.
      if (msg === ERRORE_SCADENZA) {
        await prisma.scrapeJob.update({
          where: { id: job.id },
          data: { status: "QUEUED", phase: "registro", startedAt: null, heartbeatAt: new Date() },
        });
        console.log(`[worker] job ${job.id} sospeso per tetto di durata — rimesso in coda (riprende dalla cache).`);
        break;
      }

      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: { status: "ERROR", error: msg.slice(0, 1000), finishedAt: new Date() },
      });
      console.error(`[worker] job ${job.id} ERRORE:`, msg);
    }
  }

  // Raggiunto solo in modalità ONCE (il break sopra): chiudi la connessione ed esci pulito.
  await prisma.$disconnect().catch(() => undefined);
}

main().catch((e) => {
  console.error("[worker] crash:", e);
  process.exit(1);
});
