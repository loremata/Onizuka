import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildFinanceSummaryPdfBuffer, financeSummaryPdfFilename } from "@/lib/finance-pdf";
import { loadFinanceSummaryPdfInput } from "@/lib/finance-pdf-load";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const input = await loadFinanceSummaryPdfInput(session.user.id);
  if (!input) {
    return NextResponse.json({ error: "Dati non disponibili" }, { status: 503 });
  }

  const buffer = await buildFinanceSummaryPdfBuffer(input);
  const filename = financeSummaryPdfFilename(input.monthLabel);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
