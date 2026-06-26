import { dateTimeFormatIt } from "@/lib/datetime-it";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientRetailContractsForm } from "./client-retail-contracts-form";
import { updateClientRetailContract } from "./client-retail-actions";

/** Wrapper void per usare l'azione di edit direttamente in un <form action>. */
async function submitRetailEdit(contractId: string, formData: FormData): Promise<void> {
  "use server";
  await updateClientRetailContract(contractId, formData);
}

const kindLabel: Record<string, string> = {
  MOBILE: "Telefonia mobile",
  FIBER: "Fibra / fisso",
  ENERGY: "Luce",
  GAS: "Gas",
  SKY: "Sky",
  TELEPASS: "Telepass",
  OTHER: "Altro",
};

/** Stato reminder cambio compagnia in base alla data prevista. */
function switchReminderInfo(switchReminderAt: Date | null, fmt: Intl.DateTimeFormat) {
  if (!switchReminderAt) return null;
  const days = Math.ceil((switchReminderAt.getTime() - Date.now()) / 86400000);
  if (days <= 0) return { due: true, text: "🔔 Cambio compagnia proponibile ORA" };
  const months = Math.round(days / 30);
  return { due: false, text: `Cambio compagnia tra ~${months} mesi (${fmt.format(switchReminderAt)})` };
}

export async function ClientRetailContractsCard({
  clientId,
  ownerUserId,
}: {
  clientId: string;
  ownerUserId: string;
}) {
  const contracts = await prisma.clientRetailContract.findMany({
    where: { clientId, ownerUserId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const fmt = dateTimeFormatIt({ dateStyle: "short" });

  // Spesa mensile gestita dal cliente = somma canoni dei contratti ATTIVI.
  const managedSpend = contracts
    .filter((c) => c.status === "ACTIVE")
    .reduce((sum, c) => sum + Number(c.monthlyEur.toString()), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contratti retail</CardTitle>
        <CardDescription>
          Telefonia, energia, Sky — sincronizza automaticamente una voce <strong>MRR</strong> in Finance.
          {managedSpend > 0 ? (
            <>
              {" "}Spesa gestita:{" "}
              <strong>€ {managedSpend.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mese</strong>.
            </>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {contracts.length === 0 ? (
          <p className="text-muted-foreground">Nessun contratto retail registrato.</p>
        ) : (
          <ul className="divide-y">
            {contracts.map((c) => {
              const reminder = switchReminderInfo(c.switchReminderAt, fmt);
              return (
                <li key={c.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <div>
                    <p className="font-medium">
                      {c.label}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({kindLabel[c.kind] ?? c.kind}) · {c.status}
                      </span>
                    </p>
                    {(c.operator || c.offerName || c.paymentMethod) ? (
                      <p className="text-xs text-muted-foreground">
                        {c.operator ?? ""}
                        {c.offerName ? `${c.operator ? " · " : ""}${c.offerName}` : ""}
                        {c.paymentMethod ? ` · pag. ${c.paymentMethod}` : ""}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      € {Number(c.monthlyEur.toString()).toLocaleString("it-IT")}/mese cliente
                      {c.renewalDate ? ` · rinnovo ${fmt.format(c.renewalDate)}` : ""}
                      {c.financeEntryId ? " · collegato Finance" : ""}
                    </p>
                    {reminder ? (
                      <p className={`text-xs ${reminder.due ? "font-semibold text-rose-600" : "text-muted-foreground"}`}>
                        {reminder.text}
                      </p>
                    ) : null}
                  </div>
                  <details className="mt-1 w-full text-xs">
                    <summary className="cursor-pointer text-primary hover:underline">Modifica canone / dati</summary>
                    <form
                      action={submitRetailEdit.bind(null, c.id)}
                      className="mt-2 grid gap-2 sm:grid-cols-2"
                    >
                      <label className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">Canone €/mese</span>
                        <input
                          name="monthlyEur"
                          type="text"
                          defaultValue={Number(c.monthlyEur.toString())}
                          className="h-8 rounded-md border border-input bg-background px-2"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">Operatore</span>
                        <input
                          name="operator"
                          type="text"
                          defaultValue={c.operator ?? ""}
                          className="h-8 rounded-md border border-input bg-background px-2"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">Offerta</span>
                        <input
                          name="offerName"
                          type="text"
                          defaultValue={c.offerName ?? ""}
                          className="h-8 rounded-md border border-input bg-background px-2"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">Pagamento</span>
                        <input
                          name="paymentMethod"
                          type="text"
                          defaultValue={c.paymentMethod ?? ""}
                          className="h-8 rounded-md border border-input bg-background px-2"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">Rinnovo</span>
                        <input
                          name="renewalDate"
                          type="date"
                          defaultValue={c.renewalDate ? c.renewalDate.toISOString().slice(0, 10) : ""}
                          className="h-8 rounded-md border border-input bg-background px-2"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">Cambio compagnia</span>
                        <select
                          name="switchAfterMonths"
                          defaultValue={c.switchAfterMonths ?? ""}
                          className="h-8 rounded-md border border-input bg-background px-2"
                        >
                          <option value="">—</option>
                          <option value="6">6 mesi</option>
                          <option value="12">12 mesi</option>
                          <option value="24">24 mesi</option>
                          <option value="48">48 mesi</option>
                        </select>
                      </label>
                      <div className="sm:col-span-2">
                        <button
                          type="submit"
                          className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
                        >
                          Salva e sincronizza MRR
                        </button>
                      </div>
                    </form>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
        <ClientRetailContractsForm clientId={clientId} contracts={contracts} />
      </CardContent>
    </Card>
  );
}
