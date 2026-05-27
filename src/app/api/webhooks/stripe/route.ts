import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { isStripeConfigured } from "@/lib/stripe-client";
import { notifyClientUsers } from "@/lib/user-notifications";
import { emailFinancePaymentReceipt } from "@/lib/finance-payment-receipt";

function verifyStripeSignature(payload: string, signatureHeader: string, secret: string): boolean {
  const parts = signatureHeader.split(",").map((p) => p.trim());
  const t = parts.find((p) => p.startsWith("t="))?.slice(2);
  const v1 = parts.find((p) => p.startsWith("v1="))?.slice(3);
  if (!t || !v1) return false;

  const signed = `${t}.${payload}`;
  const expected = createHmac("sha256", secret).update(signed).digest("hex");
  try {
    const a = Buffer.from(v1, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret || !isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe non configurato" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Firma mancante" }, { status: 400 });
  }

  const raw = await request.text();
  if (!verifyStripeSignature(raw, signature, secret)) {
    return NextResponse.json({ error: "Firma non valida" }, { status: 400 });
  }

  const event = JSON.parse(raw) as {
    type?: string;
    data?: { object?: { metadata?: { financeEntryId?: string }; id?: string } };
  };

  if (event.type === "checkout.session.completed") {
    const entryId = event.data?.object?.metadata?.financeEntryId;
    if (entryId) {
      const entry = await prisma.financeEntry.updateMany({
        where: { id: entryId },
        data: {
          status: "RECEIVED",
          paidAt: new Date(),
          stripeCheckoutSessionId: event.data?.object?.id ?? undefined,
        },
      });

      if (entry.count > 0) {
        const row = await prisma.financeEntry.findUnique({
          where: { id: entryId },
          select: { label: true, clientId: true, invoiceNumber: true },
        });
        if (row?.clientId) {
          void notifyClientUsers({
            clientId: row.clientId,
            kind: "invoice_paid",
            title: "Pagamento ricevuto",
            body: row.invoiceNumber
              ? `Fattura ${row.invoiceNumber} — ${row.label}`
              : row.label,
            href: "/app/invoices?paid=1",
          }).catch(() => undefined);
          void emailFinancePaymentReceipt(entryId).catch(() => undefined);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
