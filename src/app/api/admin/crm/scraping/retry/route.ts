// Rimette in coda un job non recuperabile mantenendo registroCacheJson, così il
// worker riprende il crawl dal punto raggiunto invece di ripartire da zero. Due casi:
//   - job in ERROR: fallito, va semplicemente rimesso in coda;
//   - job in RUNNING ma "bloccato": nessun heartbeat da oltre la soglia → il worker
//     che lo teneva è morto (crash/kill) e nessuno lo reclama (il worker guarda solo
//     i QUEUED). Vedi il reclaim dei PROCESSING orfani in audit-sheet-queue-processor.ts.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { triggerScraperWorkflow } from "@/lib/scraping/github-dispatch";

// Oltre questa soglia senza heartbeat un job RUNNING è considerato orfano (worker morto).
const STALE_RUNNING_MS = 30 * 60_000;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  let body: { jobId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON non valido." }, { status: 400 });
  }

  const jobId = body.jobId?.trim();
  if (!jobId) {
    return NextResponse.json({ error: "jobId obbligatorio." }, { status: 400 });
  }

  const job = await prisma.scrapeJob.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Job non trovato" }, { status: 404 });

  // Reset dei campi di esecuzione; registroCacheJson NON viene toccato:
  // è la cache incrementale che permette il resume del crawl registro.
  const resetData = {
    status: "QUEUED" as const,
    error: null,
    phase: null,
    startedAt: null,
    finishedAt: null,
  };

  if (job.status === "ERROR") {
    await prisma.scrapeJob.update({ where: { id: jobId }, data: resetData });
  } else if (job.status === "RUNNING") {
    // Sblocco di un job orfano: consentito SOLO se il heartbeat è vecchio (o assente
    // da oltre la soglia rispetto a startedAt/updatedAt). Un worker vivo aggiorna
    // heartbeatAt ad ogni progresso: quei job NON vanno toccati.
    if (!isRunningStuck(job)) {
      return NextResponse.json(
        { error: "Il job è ancora attivo (heartbeat recente): il worker sta lavorando." },
        { status: 409 }
      );
    }
    // Claim atomico condizionale: rimettiamo in coda SOLO se è ancora RUNNING e ancora
    // stale. Se nel frattempo il worker ha ripreso (heartbeat aggiornato) o l'ha chiuso,
    // count===0 e non facciamo nulla → niente reset di un job tornato vivo.
    const soglia = new Date(Date.now() - STALE_RUNNING_MS);
    const claim = await prisma.scrapeJob.updateMany({
      where: {
        id: jobId,
        status: "RUNNING",
        OR: [
          { heartbeatAt: { lt: soglia } },
          { heartbeatAt: null, startedAt: { lt: soglia } },
          { heartbeatAt: null, startedAt: null, updatedAt: { lt: soglia } },
        ],
      },
      data: resetData,
    });
    if (claim.count === 0) {
      return NextResponse.json(
        { error: "Il job è ripreso da solo (heartbeat aggiornato): sblocco annullato." },
        { status: 409 }
      );
    }
  } else {
    return NextResponse.json(
      { error: "Si possono riprovare solo i job in errore o bloccati." },
      { status: 400 }
    );
  }

  // Ri-sveglia il worker su GitHub Actions (best-effort, come per lo start).
  const dispatched = await triggerScraperWorkflow({
    jobId,
    comune: job.comune,
    provincia: job.provincia,
  });

  return NextResponse.json({ jobId, dispatched });
}

/** True se un job RUNNING non dà segni di vita da oltre la soglia (worker morto). */
function isRunningStuck(job: {
  heartbeatAt: Date | null;
  startedAt: Date | null;
  updatedAt: Date;
}): boolean {
  const limite = Date.now() - STALE_RUNNING_MS;
  const riferimento = job.heartbeatAt ?? job.startedAt ?? job.updatedAt;
  return riferimento.getTime() < limite;
}
