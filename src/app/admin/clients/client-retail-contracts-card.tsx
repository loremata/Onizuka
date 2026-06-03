import { dateTimeFormatIt } from "@/lib/datetime-it";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientRetailContractsForm } from "./client-retail-contracts-form";

const kindLabel: Record<string, string> = {
  MOBILE: "Telefonia",
  ENERGY: "Energia",
  SKY: "Sky",
  OTHER: "Altro",
};

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
            {contracts.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 py-2">
                <div>
                  <p className="font-medium">
                    {c.label}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({kindLabel[c.kind] ?? c.kind}) · {c.status}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    € {Number(c.monthlyEur.toString()).toLocaleString("it-IT")}/mese
                    {c.renewalDate ? ` · rinnovo ${fmt.format(c.renewalDate)}` : ""}
                    {c.financeEntryId ? " · collegato Finance" : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <ClientRetailContractsForm clientId={clientId} contracts={contracts} />
      </CardContent>
    </Card>
  );
}
