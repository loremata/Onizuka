import { isStripeConfigured } from "@/lib/stripe-client";

export type StripeCheckoutSession = {
  id: string;
  url: string;
};

/** Crea sessione Stripe Checkout via REST (senza SDK). */
export async function createStripeCheckoutSession(params: {
  entryId: string;
  label: string;
  amountEur: number;
  clientEmail: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<StripeCheckoutSession | { error: string }> {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret || !isStripeConfigured()) {
    return { error: "Stripe non configurato." };
  }

  const amountCents = Math.round(params.amountEur * 100);
  if (amountCents < 50) return { error: "Importo minimo non valido." };

  const body = new URLSearchParams({
    mode: "payment",
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": String(amountCents),
    "line_items[0][price_data][product_data][name]": params.label.slice(0, 120),
    "metadata[financeEntryId]": params.entryId,
  });
  if (params.clientEmail) {
    body.set("customer_email", params.clientEmail);
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const json = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!res.ok || !json.id || !json.url) {
    return { error: json.error?.message ?? "Creazione sessione Stripe fallita." };
  }

  return { id: json.id, url: json.url };
}
