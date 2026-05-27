"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClientRetailContract, updateRetailContractStatus } from "./client-retail-actions";

export function ClientRetailContractsForm({
  clientId,
  contracts,
}: {
  clientId: string;
  contracts: { id: string; status: string; label: string }[];
}) {
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3 border-t border-dashed border-border/80 pt-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            await createClientRetailContract(clientId, new FormData(e.currentTarget));
            e.currentTarget.reset();
          });
        }}
      >
        <select name="kind" className="h-9 rounded-md border border-input bg-background px-2 text-sm" defaultValue="MOBILE">
          <option value="MOBILE">Telefonia</option>
          <option value="ENERGY">Energia</option>
          <option value="SKY">Sky</option>
          <option value="OTHER">Altro</option>
        </select>
        <Input name="label" placeholder="Etichetta" className="h-9 w-36" required />
        <Input name="monthlyEur" type="number" step="0.01" min="0" placeholder="€/mese" className="h-9 w-24" required />
        <Input name="renewalDate" type="date" className="h-9 w-36" />
        <Button type="submit" size="sm" disabled={pending}>
          Aggiungi
        </Button>
      </form>
      {contracts.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {contracts
            .filter((c) => c.status === "ACTIVE")
            .map((c) => (
              <li key={c.id}>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await updateRetailContractStatus(c.id, "EXPIRED");
                    })
                  }
                >
                  Chiudi {c.label}
                </Button>
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
