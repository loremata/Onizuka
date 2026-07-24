// Rimette in coda un job fallito (ERROR → QUEUED) mantenendo registroCacheJson:
// il worker riprende il crawl dal punto raggiunto invece di ripartire da zero.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { triggerScraperWorkflow } from "@/lib/scraping/github-dispatch";

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
  if (job.status !== "ERROR") {
    return NextResponse.json({ error: "Si possono riprovare solo i job in errore." }, { status: 400 });
  }

  // Reset dei campi di esecuzione; registroCacheJson NON viene toccato:
  // è la cache incrementale che permette il resume del crawl registro.
  await prisma.scrapeJob.update({
    where: { id: jobId },
    data: {
      status: "QUEUED",
      error: null,
      phase: null,
      startedAt: null,
      finishedAt: null,
    },
  });

  // Ri-sveglia il worker su GitHub Actions (best-effort, come per lo start).
  const dispatched = await triggerScraperWorkflow({
    jobId,
    comune: job.comune,
    provincia: job.provincia,
  });

  return NextResponse.json({ jobId, dispatched });
}
