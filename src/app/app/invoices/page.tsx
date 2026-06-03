import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAppClientContext } from "@/lib/app-client-session";
import { prisma } from "@/lib/prisma";
import { isStripeConfigured } from "@/lib/stripe-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoicePayButton } from "./invoice-pay-button";

const statusLabel: Record<string, string> = {
  PLANNED: "Pianificato",
  EXPECTED: "Da incassare",
  OVERDUE: "Scaduto",
  RECEIVED: "Incassato",
  PAID: "Pagato",
};

export default async function ClientInvoicesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const ctx = await requireAppClientContext();
  const entries = await prisma.financeEntry.findMany({
    where: { clientId: ctx.clientId, type: "INCOME" },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: 40,
  });

  const dateFmt = dateTimeFormatIt({ dateStyle: "medium" });
  const paidFlash = searchParams.paid === "1";
  const stripeOn = isStripeConfigured();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="onizuka-page-title">Fatture e pagamenti</h1>
        <p className="text-muted-foreground">
          Incassi collegati al tuo account cliente.
          {stripeOn ? " Pagamento carta attivo." : " Pagamento online in configurazione."}
        </p>
        {paidFlash ? (
          <p className="mt-2 text-sm text-green-600 dark:text-green-400">
            Pagamento ricevuto. Lo stato verrà aggiornato a breve.
          </p>
        ) : null}
        <Link href="/app/dashboard" className="mt-2 inline-block text-sm text-primary hover:underline">
          ← Dashboard
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elenco</CardTitle>
          <CardDescription>Ultime voci di fatturazione.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {entries.length === 0 ? (
            <p className="text-muted-foreground">Nessuna fattura collegata al momento.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {entries.map((e) => {
                const amount = Number(e.amountEur.toString()).toLocaleString("it-IT", {
                  minimumFractionDigits: 2,
                });
                const payable =
                  stripeOn &&
                  (e.status === "EXPECTED" || e.status === "OVERDUE" || e.status === "PLANNED");
                return (
                  <li key={e.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{e.label}</p>
                      <p className="text-xs text-muted-foreground">
                        € {amount} · {statusLabel[e.status] ?? e.status}
                        {e.invoiceNumber ? ` · ${e.invoiceNumber}` : ""}
                        {e.dueDate ? ` · scad. ${dateFmt.format(e.dueDate)}` : ""}
                      </p>
                    </div>
                    {payable ? <InvoicePayButton entryId={e.id} /> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
