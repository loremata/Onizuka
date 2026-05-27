"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LeadCsvImportForm() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setResult(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/crm/leads/import", { method: "POST", body: fd });
    setPending(false);
    const j = (await res.json()) as {
      imported?: number;
      skipped?: number;
      errors?: string[];
      error?: string;
    };
    if (!res.ok) {
      setResult({ imported: 0, skipped: 0, errors: [j.error ?? "Import fallito"] });
      return;
    }
    setResult({
      imported: j.imported ?? 0,
      skipped: j.skipped ?? 0,
      errors: j.errors ?? [],
    });
    e.currentTarget.reset();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="file">File CSV</Label>
        <Input id="file" name="file" type="file" accept=".csv,text/csv" required />
        <p className="text-xs text-muted-foreground">
          Colonne: titolo/azienda, email, telefono, P.IVA, origine, stato (NEW, QUALIFIED, …).
        </p>
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Import…" : "Importa lead"}
      </Button>
      {result ? (
        <div className="rounded-md border p-3 text-xs">
          <p>
            Importati: <strong>{result.imported}</strong> · Saltati: {result.skipped}
          </p>
          {result.errors.length > 0 ? (
            <ul className="mt-2 list-disc pl-4 text-destructive">
              {result.errors.slice(0, 5).map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
