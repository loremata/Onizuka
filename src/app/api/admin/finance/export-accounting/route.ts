import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  formatFinanceAccountingCsv,
  formatFinanceDoubleEntryCsv,
} from "@/lib/finance-accounting-export";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const rows = await prisma.financeEntry.findMany({
    where: { ownerUserId: session.user.id },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: 5000,
    include: { client: { select: { companyName: true, accountingCode: true } } },
  });

  const url = new URL(req.url);
  const double = url.searchParams.get("double") === "1";
  const csv = double ? formatFinanceDoubleEntryCsv(rows) : formatFinanceAccountingCsv(rows);
  const suffix = double ? "doppia-registrazione" : "contabilita";
  const filename = `onizuka-${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
