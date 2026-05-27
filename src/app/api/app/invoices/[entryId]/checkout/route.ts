import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createStripeCheckoutSession } from "@/lib/stripe-checkout";
import { isStripeConfigured } from "@/lib/stripe-client";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "CLIENT" || !session.user.clientId) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Pagamenti online non attivi." }, { status: 503 });
  }

  const { entryId } = await params;
  const entry = await prisma.financeEntry.findFirst({
    where: {
      id: entryId,
      clientId: session.user.clientId,
      type: "INCOME",
      status: { in: ["EXPECTED", "OVERDUE", "PLANNED"] },
    },
  });

  if (!entry) {
    return NextResponse.json({ error: "Fattura non trovata." }, { status: 404 });
  }

  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "";
  const amountEur = Number(entry.amountEur.toString());
  const checkout = await createStripeCheckoutSession({
    entryId: entry.id,
    label: entry.label,
    amountEur,
    clientEmail: session.user.email ?? null,
    successUrl: `${base}/app/invoices?paid=1`,
    cancelUrl: `${base}/app/invoices?cancel=1`,
  });

  if ("error" in checkout) {
    return NextResponse.json({ error: checkout.error }, { status: 502 });
  }

  await prisma.financeEntry.update({
    where: { id: entry.id },
    data: { stripeCheckoutSessionId: checkout.id },
  });

  return NextResponse.json({ url: checkout.url });
}
