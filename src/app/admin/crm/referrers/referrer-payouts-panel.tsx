"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createReferrerPayout, markReferrerPayoutPaid } from "./payout-actions";

type PayoutRow = {
  id: string;
  amountEur: string;
  status: string;
  periodLabel: string | null;
  paidAt: Date | null;
  notes: string | null;
  paymentReference: string | null;
  documentUrl: string | null;
  createdAt: Date;
};

export function ReferrerPayoutsPanel({
  referrerId,
  payouts,
}: {
  referrerId: string;
  payouts: PayoutRow[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fmt = new Intl.DateTimeFormat("it-IT", { dateStyle: "short" });

  return (
    <div className="space-y-4 text-sm">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <form
        encType="multipart/form-data"
        className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border/80 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            setError(null);
            const res = await createReferrerPayout(referrerId, fd);
            if (res?.error) setError(res.error);
            else e.currentTarget.reset();
          });
        }}
      >
        <div>
          <label className="text-xs text-muted-foreground">Importo €</label>
          <Input name="amountEur" type="number" step="0.01" min="0" required className="h-9 w-28" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Periodo</label>
          <Input name="periodLabel" placeholder="Q2 2026" className="h-9 w-32" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Note</label>
          <Input name="notes" className="h-9 w-48" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Rif. bonifico</label>
          <Input name="paymentReference" className="h-9 w-36" placeholder="CRO / TRN" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">URL documento</label>
          <Input name="documentUrl" type="url" className="h-9 w-56" placeholder="https://…" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">File documento</label>
          <input
            name="documentFile"
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp"
            className="block max-w-[200px] text-xs"
          />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          Registra liquidazione
        </Button>
      </form>
      {payouts.length === 0 ? (
        <p className="text-muted-foreground">Nessuna liquidazione registrata.</p>
      ) : (
        <ul className="divide-y">
          {payouts.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <p className="font-medium">
                  {Number(p.amountEur).toLocaleString("it-IT", { maximumFractionDigits: 2 })} € ·{" "}
                  {p.status === "PAID" ? "Pagato" : "In attesa"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fmt.format(p.createdAt)}
                  {p.periodLabel ? ` · ${p.periodLabel}` : ""}
                  {p.paidAt ? ` · pagato ${fmt.format(p.paidAt)}` : ""}
                  {p.notes ? ` · ${p.notes}` : ""}
                  {p.paymentReference ? ` · rif. ${p.paymentReference}` : ""}
                </p>
                {p.documentUrl ? (
                  <a href={p.documentUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                    Documento liquidazione
                  </a>
                ) : null}
              </div>
              {p.status === "PENDING" ? (
                <form
                  encType="multipart/form-data"
                  className="flex flex-wrap items-end gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    start(async () => {
                      setError(null);
                      const res = await markReferrerPayoutPaid(p.id, new FormData(e.currentTarget));
                      if (res?.error) setError(res.error);
                    });
                  }}
                >
                  <Input name="paymentReference" placeholder="CRO" className="h-8 w-24 text-xs" />
                  <Input name="documentUrl" type="url" placeholder="URL doc" className="h-8 w-32 text-xs" />
                  <input
                    name="documentFile"
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    className="max-w-[120px] text-xs"
                  />
                  <Button type="submit" size="sm" variant="secondary" disabled={pending}>
                    Segna pagato
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
