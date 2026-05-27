import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminAreaRole } from "@/lib/auth-roles";
import { prisma } from "@/lib/prisma";
import { pushTimeEntriesToSapApi, pushTimeEntriesToZucchettiApi } from "@/lib/time-erp-certified";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isAdminAreaRole(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const vendor = new URL(request.url).searchParams.get("vendor")?.trim().toLowerCase();
  if (vendor !== "zucchetti" && vendor !== "sap") {
    return NextResponse.json({ error: "vendor=zucchetti|sap richiesto." }, { status: 400 });
  }

  const rows = await prisma.timeEntry.findMany({
    where: { ownerUserId: session.user.id },
    orderBy: { workedAt: "desc" },
    take: 500,
    include: {
      client: { select: { companyName: true } },
      owner: { select: { email: true } },
    },
  });

  const result =
    vendor === "sap"
      ? await pushTimeEntriesToSapApi(rows, session.user.id)
      : await pushTimeEntriesToZucchettiApi(rows, session.user.id);

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
