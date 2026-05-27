import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadQuotePdfForOwner } from "@/lib/quote-pdf-load";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ quoteId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { quoteId } = await params;
  const loaded = await loadQuotePdfForOwner(quoteId, session.user.id);

  if (!loaded.ok) {
    return NextResponse.json({ error: "Preventivo non trovato" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(loaded.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${loaded.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
