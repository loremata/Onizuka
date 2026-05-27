"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type FinanceReconciliationDiag = {
  healthy: boolean;
  stripeEnabled: boolean;
  issues: { id: string; label: string; count: number; severity: string }[];
};

type Diagnostics = {
  productionReady: boolean;
  database: string;
  weakSeedEmails: string[];
  mustChangePasswordCount?: number;
  readinessTodo: number;
  deploy: { issues: string[]; warnings: string[]; productionReady: boolean };
  financeReconciliation?: FinanceReconciliationDiag | null;
};

export function GoLiveDiagnosticsPanel() {
  const [data, setData] = useState<Diagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError(null);
    fetch("/api/admin/go-live/diagnostics", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("diagnostics");
        return res.json() as Promise<Diagnostics>;
      })
      .then(setData)
      .catch(() => setError("Diagnostica non disponibile"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">Caricamento diagnostica…</p>;
  }

  if (error) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-destructive">{error}</p>
        <Button type="button" size="sm" variant="outline" onClick={load}>
          Riprova
        </Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          Stato complessivo:{" "}
          <span className={data.productionReady ? "font-medium text-green-600" : "font-medium text-destructive"}>
            {data.productionReady ? "Pronto" : "Azioni richieste"}
          </span>
          {" · "}DB: {data.database}
          {" · "}Checklist todo: {data.readinessTodo}
        </p>
        <Button type="button" size="sm" variant="ghost" onClick={load} disabled={loading}>
          Aggiorna
        </Button>
      </div>

      {data.deploy.issues.length > 0 ? (
        <div>
          <p className="font-medium text-destructive">Blocchi</p>
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            {data.deploy.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.weakSeedEmails.length > 0 ? (
        <p className="text-destructive">
          Password seed attive: <span className="font-mono">{data.weakSeedEmails.join(", ")}</span>
        </p>
      ) : null}

      {(data.mustChangePasswordCount ?? 0) > 0 ? (
        <p className="text-destructive">
          Account con cambio password obbligatorio: {data.mustChangePasswordCount}
        </p>
      ) : null}

      {data.financeReconciliation ? (
        <div>
          <p className="font-medium">Finance — riconciliazione</p>
          <p className="text-muted-foreground">
            Stripe: {data.financeReconciliation.stripeEnabled ? "attivo" : "non configurato"} ·{" "}
            {data.financeReconciliation.healthy ? (
              <span className="text-green-600">registro coerente</span>
            ) : (
              <span className="text-amber-600">
                {data.financeReconciliation.issues.length} anomalie da verificare
              </span>
            )}
          </p>
          {data.financeReconciliation.issues.length > 0 ? (
            <ul className="mt-1 list-inside list-disc text-muted-foreground">
              {data.financeReconciliation.issues.map((i) => (
                <li key={i.id}>
                  {i.label}: {i.count}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {data.deploy.warnings.length > 0 ? (
        <div>
          <p className="font-medium text-amber-600">Avvisi</p>
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            {data.deploy.warnings.slice(0, 6).map((w) => (
              <li key={w}>{w}</li>
            ))}
            {data.deploy.warnings.length > 6 ? (
              <li>…e altri {data.deploy.warnings.length - 6}</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
