import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { formatOpportunitiesCsv } from "@/lib/crm-export";
import { buildOwnedOpportunityWhere, parseOpportunityListFilters } from "@/lib/opportunity-list-filters";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const url = new URL(request.url);
  const filters = parseOpportunityListFilters({
    q: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    priority: url.searchParams.get("priority") ?? undefined,
    clientId: url.searchParams.get("clientId") ?? undefined,
    assetId: url.searchParams.get("assetId") ?? undefined,
  });

  const rows = await prisma.opportunity.findMany({
    where: buildOwnedOpportunityWhere(session.user.id, filters),
    orderBy: { updatedAt: "desc" },
    take: 5000,
    include: {
      client: { select: { companyName: true } },
      asset: { select: { name: true } },
    },
  });

  const csv = formatOpportunitiesCsv(rows);
  const filename = `onizuka-opportunita-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
