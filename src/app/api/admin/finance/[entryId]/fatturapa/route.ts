import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminAreaRole } from "@/lib/auth-roles";
import { prisma } from "@/lib/prisma";
import { buildFatturaPaXml, fatturaPaFilename } from "@/lib/finance-fatturapa";

export async function GET(_request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdminAreaRole(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { entryId } = await params;
  const entry = await prisma.financeEntry.findFirst({
    where: { id: entryId, ownerUserId: session.user.id, type: "INCOME" },
    include: { client: { select: { companyName: true, vatNumber: true } } },
  });

  if (!entry) {
    return NextResponse.json({ error: "Voce non trovata" }, { status: 404 });
  }

  const xml = buildFatturaPaXml({
    entry,
    clientName: entry.client?.companyName ?? null,
    clientVat: entry.client?.vatNumber ?? null,
    issuerName: process.env.ONIZUKA_ISSUER_NAME?.trim() ?? "Lorenzo Matarazzo",
    issuerVat: process.env.ONIZUKA_ISSUER_VAT?.trim() ?? "",
  });

  const filename = fatturaPaFilename(entry.invoiceNumber ?? entry.id);

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
