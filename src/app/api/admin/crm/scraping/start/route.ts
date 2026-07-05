// Avvia un job di scraping per un comune: crea una riga ScrapeJob (status QUEUED)
// che il worker esterno (sul PC) prenderà in carico.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PROVINCE_ITALIA } from "@/lib/scraping/comuni-italia";
import { triggerScraperWorkflow } from "@/lib/scraping/github-dispatch";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  let body: { provincia?: string; comune?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON non valido." }, { status: 400 });
  }

  const provincia = body.provincia?.trim();
  const comune = body.comune?.trim();
  if (!provincia || !comune) {
    return NextResponse.json({ error: "Provincia e comune sono obbligatori." }, { status: 400 });
  }

  const prov = PROVINCE_ITALIA.find((p) => p.nome === provincia);
  const com = prov?.comuni.find((c) => c.nome === comune);
  if (!prov || !com) {
    return NextResponse.json({ error: "Comune non riconosciuto." }, { status: 400 });
  }

  // Evita doppioni: se c'è già un job attivo per lo stesso comune, riusa quello.
  const esistente = await prisma.scrapeJob.findFirst({
    where: { comune, provincia, status: { in: ["QUEUED", "RUNNING"] } },
    orderBy: { createdAt: "desc" },
  });
  if (esistente) {
    // Se è ancora in coda, ri-sveglia il worker su GitHub Actions (un dispatch
    // precedente può essere andato perso); se già RUNNING non serve.
    const dispatched =
      esistente.status === "QUEUED"
        ? await triggerScraperWorkflow({ jobId: esistente.id, comune, provincia })
        : false;
    return NextResponse.json({ jobId: esistente.id, reused: true, dispatched });
  }

  const job = await prisma.scrapeJob.create({
    data: {
      ownerUserId: session.user.id,
      provincia,
      comune,
      registroSlug: com.slug,
      status: "QUEUED",
    },
  });

  // Avvia il worker su GitHub Actions (best-effort: se non configurato/fallisce,
  // il job resta QUEUED e si può lanciare a mano dalla tab Actions).
  const dispatched = await triggerScraperWorkflow({ jobId: job.id, comune, provincia });

  return NextResponse.json({ jobId: job.id, dispatched });
}
