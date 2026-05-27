import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminAreaRole } from "@/lib/auth-roles";
import { prisma } from "@/lib/prisma";
import { formatTimeEntriesCsv } from "@/lib/time-entry-export";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isAdminAreaRole(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const rows = await prisma.timeEntry.findMany({
    where: { ownerUserId: session.user.id },
    orderBy: { workedAt: "desc" },
    take: 10000,
    include: { client: { select: { companyName: true } } },
  });

  const csv = formatTimeEntriesCsv(rows);
  const filename = `onizuka-time-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
