import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminAreaRole } from "@/lib/auth-roles";
import { formatLeadsCsv } from "@/lib/crm-export";
import { buildOwnedLeadWhere, parseLeadListFilters } from "@/lib/lead-list-filters";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isAdminAreaRole(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const url = new URL(request.url);
  const filters = parseLeadListFilters({
    q: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    referrerId: url.searchParams.get("referrerId") ?? undefined,
  });

  const rows = await prisma.lead.findMany({
    where: buildOwnedLeadWhere(session.user.id, filters),
    orderBy: { updatedAt: "desc" },
    take: 5000,
    include: { convertedClient: { select: { companyName: true } } },
  });

  const csv = formatLeadsCsv(rows);
  const filename = `onizuka-lead-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
