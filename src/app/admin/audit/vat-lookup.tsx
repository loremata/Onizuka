"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

type LookupResult = {
  found: boolean;
  client?: {
    id: string;
    companyName: string;
    vatNumber: string | null;
    status: string;
    score: number;
    band: string;
    factors: string[];
  };
};

export function VatLookup() {
  const [vat, setVat] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onLookup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/audit/vat?q=${encodeURIComponent(vat.trim())}`);
      const data = (await res.json()) as LookupResult & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Errore ricerca");
        return;
      }
      setResult(data);
    } catch {
      setError("Richiesta fallita");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onLookup} className="flex flex-wrap gap-2">
        <Input
          value={vat}
          onChange={(e) => setVat(e.target.value)}
          placeholder="P.IVA / CF (es. IT12345678901)"
          className="max-w-xs"
        />
        <Button type="submit" size="sm" disabled={loading || vat.trim().length < 5}>
          {loading ? "…" : "Cerca in anagrafica"}
        </Button>
      </form>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {result && !result.found ? (
        <p className="text-sm text-muted-foreground">Nessun cliente con questa P.IVA. Crea lead o cliente.</p>
      ) : null}
      {result?.client ? (
        <div className="rounded-md border border-border/60 p-3 text-sm">
          <Link className="font-medium text-primary hover:underline" href={`/admin/clients/${result.client.id}`}>
            {result.client.companyName}
          </Link>
          <p className="mt-1 text-muted-foreground">
            Score audit MVP: <strong>{result.client.score}/100</strong> ({result.client.band})
          </p>
          <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
            {result.client.factors.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
