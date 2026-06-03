import { dateTimeFormatIt } from "@/lib/datetime-it";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildFinanceEntryPdfBuffer, financeEntryPdfFilename } from "@/lib/finance-entry-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { entryId } = await params;
  const entry = await prisma.financeEntry.findFirst({
    where: { id: entryId, ownerUserId: session.user.id },
    include: {
      client: { select: { companyName: true, vatNumber: true } },
      asset: { select: { name: true } },
    },
  });

  if (!entry) {
    return NextResponse.json({ error: "Voce non trovata" }, { status: 404 });
  }

  const dateFmt = dateTimeFormatIt({ dateStyle: "long" });
  const amountEur = Number(entry.amountEur.toString()).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
  });

  const buffer = await buildFinanceEntryPdfBuffer({
    entryId: entry.id,
    label: entry.label,
    type: entry.type,
    status: entry.status,
    amountEur,
    clientName: entry.client?.companyName ?? null,
    clientVat: entry.client?.vatNumber ?? null,
    assetName: entry.asset?.name ?? null,
    invoiceNumber: entry.invoiceNumber,
    dueDate: entry.dueDate ? dateFmt.format(entry.dueDate) : null,
    paidAt: entry.paidAt ? dateFmt.format(entry.paidAt) : null,
    notes: entry.notes,
  });

  const filename = financeEntryPdfFilename(entry.label, entry.id);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
