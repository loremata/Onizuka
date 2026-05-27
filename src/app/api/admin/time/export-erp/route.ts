import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminAreaRole } from "@/lib/auth-roles";
import { prisma } from "@/lib/prisma";
import { formatTimeEntriesForErpVendor, type ErpVendor } from "@/lib/time-erp-vendors";

export const runtime = "nodejs";

function parseVendor(raw: string | null): ErpVendor {
  const v = raw?.trim().toLowerCase();
  if (v === "zucchetti") return "zucchetti";
  if (v === "teamsystem") return "teamsystem";
  if (v === "sap") return "sap";
  return "generic";
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isAdminAreaRole(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const vendor = parseVendor(new URL(request.url).searchParams.get("vendor"));

  const rows = await prisma.timeEntry.findMany({
    where: { ownerUserId: session.user.id },
    orderBy: { workedAt: "desc" },
    take: 10000,
    include: {
      client: { select: { companyName: true } },
      owner: { select: { email: true } },
    },
  });

  const csv = formatTimeEntriesForErpVendor(rows, vendor);
  const suffix = vendor === "generic" ? "erp" : vendor;
  const filename = `onizuka-time-${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
