// Stato di un job (per la barra di avanzamento) e ultimi job recenti.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const jobId = new URL(request.url).searchParams.get("jobId")?.trim();

  if (jobId) {
    const job = await prisma.scrapeJob.findUnique({ where: { id: jobId } });
    if (!job) return NextResponse.json({ error: "Job non trovato" }, { status: 404 });
    return NextResponse.json({ job });
  }

  // Senza jobId: ultimi 10 job.
  const jobs = await prisma.scrapeJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return NextResponse.json({ jobs });
}
