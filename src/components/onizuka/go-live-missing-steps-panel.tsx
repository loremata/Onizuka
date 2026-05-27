"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { GoLiveMissingStepsReport, MissingStep } from "@/lib/go-live-missing-steps";

type DiagnosticsPayload = {
  missingSteps?: GoLiveMissingStepsReport;
  batchFMigration?: { batchF: boolean; hint?: string };
};

const categoryLabel = {
  required: "Obbligatori",
  recommended: "Consigliati",
  optional: "Opzionali",
} as const;

function StepList({ steps, category }: { steps: MissingStep[]; category: MissingStep["category"] }) {
  const filtered = steps.filter((s) => s.category === category);
  if (filtered.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {categoryLabel[category]} ({filtered.filter((s) => s.status === "todo").length} todo)
      </p>
      <ul className="space-y-2">
        {filtered.map((s) => (
          <li
            key={s.id}
            className={`rounded-md border px-3 py-2 text-sm ${
              s.status === "done"
                ? "border-emerald-500/30 opacity-70"
                : s.status === "manual"
                  ? "border-amber-500/30"
                  : "border-destructive/40"
            }`}
          >
            <div className="flex justify-between gap-2">
              <span>{s.label}</span>
              <span className="shrink-0 text-[10px] uppercase text-muted-foreground">{s.status}</span>
            </div>
            {s.hint ? <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GoLiveMissingStepsPanel() {
  const [data, setData] = useState<DiagnosticsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch("/api/admin/go-live/diagnostics", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">Caricamento passi mancanti…</p>;
  }

  const report = data?.missingSteps;
  if (!report) {
    return (
      <p className="text-sm text-destructive">
        Elenco non disponibile.{" "}
        <Button type="button" variant="link" className="h-auto p-0" onClick={load}>
          Riprova
        </Button>
      </p>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          Codice prodotto:{" "}
          <span className="font-medium text-emerald-600">
            {report.productCodeComplete ? "completo" : "in corso"}
          </span>
          {" · "}
          Obbligatori aperti:{" "}
          <span className={report.requiredOpen ? "font-medium text-destructive" : "font-medium"}>
            {report.requiredOpen}
          </span>
          {" · "}
          Consigliati: {report.recommendedOpen} · Opzionali: {report.optionalOpen}
        </p>
        <Button type="button" size="sm" variant="ghost" onClick={load} disabled={loading}>
          Aggiorna
        </Button>
      </div>
      {data.batchFMigration && !data.batchFMigration.batchF ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive">
          {data.batchFMigration.hint}
        </p>
      ) : null}
      <StepList steps={report.steps} category="required" />
      <StepList steps={report.steps} category="recommended" />
      <StepList steps={report.steps} category="optional" />
      <p className="text-xs text-muted-foreground">
        Sincronizzato con variabili server e DB. Elenco completo in repo:{" "}
        <code className="text-[10px]">PASSI-MANCANTI.md</code> · locale{" "}
        <code className="text-[10px]">passi-mancanti:full</code> · prod{" "}
        <code className="text-[10px]">passi-mancanti:prod</code>
      </p>
    </div>
  );
}
