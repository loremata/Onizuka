"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type ScanRun = {
  id: string;
  status: string;
  groupCount: number | null;
  fuzzyIndexedClients: number;
  summaryJson: string | null;
  errorDetail: string | null;
  startedAt: string;
  completedAt: string | null;
};

export function DedupeScanPanel({ initialRun }: { initialRun: ScanRun | null }) {
  const [run, setRun] = useState<ScanRun | null>(initialRun);
  const [pending, start] = useTransition();

  function poll(runId: string, attempt = 0) {
    if (attempt > 40) return;
    fetch(`/api/admin/crm/dedupe/scan?runId=${encodeURIComponent(runId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.run) {
          setRun({
            ...data.run,
            startedAt: data.run.startedAt,
            completedAt: data.run.completedAt,
          });
          if (data.run.status === "PENDING" || data.run.status === "RUNNING") {
            setTimeout(() => poll(runId, attempt + 1), 1500);
          }
        }
      })
      .catch(() => {});
  }

  return (
    <div className="rounded-md border border-dashed border-border/80 p-4 text-sm">
      <p className="font-medium">Scansione completa (background)</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Esegue dedupe fuzzy su fino a 10.000 anagrafiche senza bloccare la pagina. I risultati restano in cronologia.
      </p>
      <Button
        type="button"
        size="sm"
        className="mt-3"
        variant="secondary"
        disabled={pending || run?.status === "RUNNING"}
        onClick={() =>
          start(async () => {
            const res = await fetch("/api/admin/crm/dedupe/scan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fuzzyIndexedClients: 10000 }),
            });
            const data = await res.json();
            if (data.runId) poll(data.runId);
          })
        }
      >
        {pending || run?.status === "RUNNING" ? "Scansione in corso…" : "Avvia scansione 10k"}
      </Button>
      {run ? (
        <div className="mt-3 text-xs text-muted-foreground">
          <p>
            Ultima: <strong>{run.status}</strong>
            {run.groupCount != null ? ` · ${run.groupCount} gruppi` : ""}
            {run.fuzzyIndexedClients ? ` · cap ${run.fuzzyIndexedClients}` : ""}
          </p>
          {run.status === "FAILED" && run.errorDetail ? (
            <p className="text-destructive">{run.errorDetail}</p>
          ) : null}
          {run.summaryJson && run.status === "DONE" ? (
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/40 p-2 text-[11px]">
              {JSON.stringify(JSON.parse(run.summaryJson), null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
