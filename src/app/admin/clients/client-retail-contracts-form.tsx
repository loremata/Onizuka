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
          <option value="MOBILE">Telefonia mobile</option>
          <option value="FIBER">Fibra / fisso</option>
          <option value="ENERGY">Luce</option>
          <option value="GAS">Gas</option>
          <option value="SKY">Sky</option>
          <option value="TELEPASS">Telepass</option>
          <option value="OTHER">Altro</option>
        </select>
        <Input name="label" placeholder="Etichetta" className="h-9 w-32" required />
        <Input name="operator" placeholder="Operatore (Fastweb…)" className="h-9 w-36" />
        <Input name="offerName" placeholder="Offerta" className="h-9 w-40" />
        <Input name="monthlyEur" type="number" step="0.01" min="0" placeholder="€/mese cliente" className="h-9 w-28" required />
        <select name="paymentMethod" className="h-9 rounded-md border border-input bg-background px-2 text-sm" defaultValue="IBAN">
          <option value="">Pagamento…</option>
          <option value="IBAN">IBAN</option>
          <option value="Carta di credito">Carta</option>
          <option value="Bollettino">Bollettino</option>
          <option value="Bonifico">Bonifico</option>
        </select>
        <label className="flex flex-col text-[10px] text-muted-foreground">
          Firma
          <Input name="signedAt" type="date" className="h-9 w-36" />
        </label>
        <select name="switchAfterMonths" className="h-9 rounded-md border border-input bg-background px-2 text-sm" defaultValue="24" title="Reminder cambio compagnia">
          <option value="">Cambio dopo…</option>
          <option value="6">6 mesi</option>
          <option value="12">12 mesi</option>
          <option value="24">24 mesi</option>
          <option value="48">48 mesi</option>
        </select>
        <Input name="renewalDate" type="date" className="h-9 w-36" title="Data rinnovo/scadenza" />
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
