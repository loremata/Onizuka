// Worker di scraping — gira sul PC dell'utente (non su Vercel).
// Polla i ScrapeJob in coda, esegue registro → Places → dedup → import Lead,
// aggiornando progresso e contatori sul job. Usa curl (nativo) per il registro.
//
// Avvio:  npx tsx scripts/scraper-worker.ts   (o il file .bat)
// Env richieste in .env.local: DATABASE_URL (Supabase) + GOOGLE_PLACES_API_KEY.
import { loadDotEnvFiles, loadEnvFile } from "./load-dotenv.mjs";
loadDotEnvFiles();
// Override dedicato al worker (es. DATABASE_URL di PRODUZIONE + GOOGLE_PLACES_API_KEY),
// tenuto separato da .env/.env.local usati dal dev. Opzionale: se non c'è, si usa .env.
loadEnvFile(process.cwd(), ".env.worker", { override: true });

const POLL_MS = 5000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mask = (u?: string) => (u ? u.replace(/:[^:@]+@/, ":***@") : "(mancante)");

async function main() {
  // Import dinamici DOPO il caricamento env (Prisma legge DATABASE_URL all'istanza).
  const { prisma } = await import("@/lib/prisma");
  const { registroSlugCandidates } = await import("@/lib/scraping/registro-slug");
  const { scrapeRegistro } = await import("@/lib/scraping/registro");
  const { scrapePlaces } = await import("@/lib/scraping/places");
  const { resolveCompanies } = await import("@/lib/scraping/resolve");
  const { importScrapedCompanies } = await import("@/lib/scraping/import-leads");
  const { PROVINCE_ITALIA } = await import("@/lib/scraping/comuni-italia");
  type ProgressArg = { phase: string; current?: number; total?: number; note?: string };

  const apiKey = process.env.GOOGLE_PLACES_API_KEY || "";
  console.log(`[worker] avviato. DB: ${mask(process.env.DATABASE_URL)} · Places key: ${apiKey ? "presente" : "ASSENTE"}`);
  if (!apiKey) console.log("[worker] ⚠️  senza GOOGLE_PLACES_API_KEY l'arricchimento Google sarà saltato.");

  for (;;) {
    // Claim di un job in coda (worker singolo: findFirst + update).
    const next = await prisma.scrapeJob.findFirst({
      where: { status: "QUEUED" },
      orderBy: { createdAt: "asc" },
    });
    if (!next) {
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

    try {
      // 1) Registro (base): stato, P.IVA, ATECO.
      const candidati = registroSlugCandidates(job.comune, job.provincia);
      const { items: registro } = await scrapeRegistro(candidati, onProgress);
      const active = registro.filter((r) => r.stato === "attiva").length;
      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: { totalFound: registro.length, activeCount: active, excludedCount: registro.length - active },
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
      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: { status: "ERROR", error: msg.slice(0, 1000), finishedAt: new Date() },
      });
      console.error(`[worker] job ${job.id} ERRORE:`, msg);
    }
  }
}

main().catch((e) => {
  console.error("[worker] crash:", e);
  process.exit(1);
});
