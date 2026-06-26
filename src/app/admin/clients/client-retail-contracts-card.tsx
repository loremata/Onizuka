import { dateTimeFormatIt } from "@/lib/datetime-it";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientRetailContractsForm } from "./client-retail-contracts-form";

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contratti retail</CardTitle>
        <CardDescription>
          Telefonia, energia, Sky — sincronizza automaticamente una voce <strong>MRR</strong> in Finance.
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
