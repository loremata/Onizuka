"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DedupeTrainingPanel({ modelVersion }: { modelVersion: number }) {
  const [weights, setWeights] = useState('{"featureWeights": {}}');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">Training pipeline dedupe</CardTitle>
        <CardDescription>
          Esporta dataset JSONL, addestra offline, reimporta pesi (versione modello: {modelVersion}).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <a href="/api/admin/crm/dedupe/training/export">Export JSONL</a>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setMsg(null);
              start(async () => {
                const res = await fetch("/api/admin/crm/dedupe/training/train", { method: "POST" });
                const data = (await res.json()) as {
                  version?: number;
                  pairs?: number;
                  backfilled?: number;
                  error?: string;
                };
                setMsg(
                  res.ok
                    ? `Train CPU OK — v${data.version}, ${data.pairs} coppie, ${data.backfilled} embedding`
                    : data.error ?? "Errore"
                );
              });
            }}
          >
            Addestra in-app (CPU)
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => {
              setMsg(null);
              start(async () => {
                const res = await fetch("/api/admin/crm/dedupe/training/import", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ weightsJson: weights, notes: "import UI" }),
                });
                const data = (await res.json()) as { version?: number; error?: string };
                setMsg(res.ok ? `Import OK — v${data.version}` : data.error ?? "Errore");
              });
            }}
          >
            Import pesi + re-backfill
          </Button>
        </div>
        <textarea
          className="min-h-[80px] w-full rounded-md border border-input bg-background px-2 py-1 font-mono text-xs"
          value={weights}
          onChange={(e) => setWeights(e.target.value)}
        />
        {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
      </CardContent>
    </Card>
  );
}
