"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Pair = {
  clientAId: string;
  clientBId: string;
  companyA: string;
  companyB: string;
  score: number;
};

export function DedupeEmbeddingPanel() {
  const [pairs, setPairs] = useState<Pair[] | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    fetch("/api/admin/crm/dedupe/embedding")
      .then(async (res) => res.json() as Promise<{ pairs: Pair[]; configured: boolean }>)
      .then((data) => {
        setConfigured(data.configured);
        setPairs(data.pairs ?? []);
      })
      .catch(() => {
        setConfigured(false);
        setPairs([]);
      });
  }, []);

  if (configured === false) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Dedupe ML (embedding)</CardTitle>
          <CardDescription>
            Richiede <span className="font-mono">OPENAI_API_KEY</span> e{" "}
            <span className="font-mono">ONIZUKA_EMBEDDINGS</span> ≠ 0.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (pairs === null) {
    return <p className="text-sm text-muted-foreground">Caricamento suggerimenti embedding…</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dedupe ML (embedding)</CardTitle>
        <CardDescription>
          Coppie simili (cosine ≥ 88%) — usa embedding persistente su <code className="text-xs">Client.dedupeEmbedding</code> quando presente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setBackfillMsg(null);
            start(async () => {
              const res = await fetch("/api/admin/crm/dedupe/embedding/backfill", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ limit: 50 }),
              });
              const data = (await res.json()) as { processed?: number; errors?: string[] };
              setBackfillMsg(
                res.ok
                  ? `Backfill: ${data.processed ?? 0} clienti${data.errors?.length ? ` (${data.errors.length} errori)` : ""}.`
                  : "Backfill non riuscito."
              );
              const refresh = await fetch("/api/admin/crm/dedupe/embedding");
              const emb = (await refresh.json()) as { pairs: Pair[] };
              setPairs(emb.pairs ?? []);
            });
          }}
        >
          Backfill embedding (50)
        </Button>
        {backfillMsg ? <p className="text-xs text-muted-foreground">{backfillMsg}</p> : null}
        {pairs.length === 0 ? (
          <p className="text-muted-foreground">Nessuna coppia sopra soglia.</p>
        ) : (
          <ul className="divide-y">
            {pairs.map((p) => (
              <li key={`${p.clientAId}-${p.clientBId}`} className="py-2">
                <span className="font-medium">{p.score}%</span> ·{" "}
                <Link href={`/admin/clients/${p.clientAId}`} className="text-primary hover:underline">
                  {p.companyA}
                </Link>
                {" ↔ "}
                <Link href={`/admin/clients/${p.clientBId}`} className="text-primary hover:underline">
                  {p.companyB}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
