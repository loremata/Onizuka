import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scoreClientForAudit } from "@/lib/audit-client-score";
import { findClientByFiscalIdentity } from "@/lib/client-fiscal-identity";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim().replace(/\s/g, "");
  if (!q || q.length < 5) {
    return NextResponse.json({ error: "P.IVA troppo corta" }, { status: 400 });
  }

  const match = await findClientByFiscalIdentity({ vatNumber: q });
  if (!match) {
    return NextResponse.json({ found: false });
  }

  const client = await prisma.client.findUnique({
    where: { id: match.id },
    include: {
      _count: { select: { posts: true, assets: true, opportunities: true, contacts: true } },
      opportunities: { select: { status: true, estimatedValue: true } },
    },
  });

  if (!client) {
    return NextResponse.json({ found: false });
  }

  const scored = scoreClientForAudit(client);
  return NextResponse.json({
    found: true,
    client: {
      id: client.id,
      companyName: client.companyName,
      vatNumber: client.vatNumber,
      status: client.status,
      score: scored.score,
      band: scored.band,
      factors: scored.factors,
    },
  });
}
