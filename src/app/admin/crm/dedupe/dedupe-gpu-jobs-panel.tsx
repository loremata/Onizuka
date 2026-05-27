"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type JobRow = {
  id: string;
  status: string;
  pairsCount: number;
  datasetUrl: string | null;
  weightsVersion: number | null;
  createdAt: string;
  completedAt: string | null;
};

export function DedupeGpuJobsPanel({ jobs }: { jobs: JobRow[] }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">Job training GPU / cloud</CardTitle>
        <CardDescription>
          Accoda export JSONL su S3 + webhook <code className="text-xs">DEDUPE_GPU_WEBHOOK_URL</code> oppure cron{" "}
          <code className="text-xs">/api/cron/dedupe-training</code> (fallback CPU).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => {
            setMsg(null);
            start(async () => {
              const res = await fetch("/api/admin/crm/dedupe/training/gpu-job", { method: "POST" });
              const data = (await res.json()) as { jobId?: string; pairsCount?: number; error?: string };
              setMsg(
                res.ok
                  ? `Job ${data.jobId} — ${data.pairsCount} coppie`
                  : data.error ?? "Errore"
              );
            });
          }}
        >
          Accoda job GPU
        </Button>
        {jobs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nessun job recente.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {jobs.map((j) => (
              <li key={j.id} className="rounded border px-2 py-1">
                <span className="font-mono">{j.id.slice(0, 8)}</span> · {j.status} · {j.pairsCount} coppie
                {j.weightsVersion ? ` · v${j.weightsVersion}` : ""}
                {j.completedAt
                  ? ` · ${new Date(j.completedAt).toLocaleString("it-IT")}`
                  : ` · ${new Date(j.createdAt).toLocaleString("it-IT")}`}
              </li>
            ))}
          </ul>
        )}
        {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
      </CardContent>
    </Card>
  );
}
