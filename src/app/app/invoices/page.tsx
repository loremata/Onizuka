import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { requireAppClientContext } from "@/lib/app-client-session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const statusLabel: Record<string, string> = {
  PLANNED: "Pianificato",
  EXPECTED: "Da incassare",
  OVERDUE: "Scaduto",
  RECEIVED: "Incassato",
  PAID: "Pagato",
};

/**
 * Pagina informativa: elenca le voci di fatturazione collegate al cliente.
 * Fatturazione e incassi sono gestiti dall'amministrazione (commercialista):
 * qui non si paga nulla, si consulta lo stato.
 */
export default async function ClientInvoicesPage() {
  const ctx = await requireAppClientContext();
  const entries = await prisma.financeEntry.findMany({
    where: { clientId: ctx.clientId, type: "INCOME" },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: 40,
  });

  const dateFmt = dateTimeFormatIt({ dateStyle: "medium" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="onizuka-page-title">Fatture e pagamenti</h1>
        <p className="text-muted-foreground">
          Situazione delle voci collegate al tuo account. Per pagamenti e documenti
          fiscali fai riferimento alle indicazioni ricevute in fattura.
        </p>
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
                return (
                  <li key={e.id} className="py-3">
                    <p className="font-medium">{e.label}</p>
                    <p className="text-xs text-muted-foreground">
                      € {amount} · {statusLabel[e.status] ?? e.status}
                      {e.invoiceNumber ? ` · ${e.invoiceNumber}` : ""}
                      {e.dueDate ? ` · scad. ${dateFmt.format(e.dueDate)}` : ""}
                    </p>
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
