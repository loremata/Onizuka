import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendQuoteEmail } from "@/lib/quote-email";

export async function POST(_request: Request, { params }: { params: Promise<{ quoteId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { quoteId } = await params;
  const result = await sendQuoteEmail(quoteId, session.user.id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error.includes("non configurato") ? 503 : 400 });
  }

  return NextResponse.json({ ok: true, sent: true });
}
