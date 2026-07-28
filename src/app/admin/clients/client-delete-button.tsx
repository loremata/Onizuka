"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClientMergeImpactRow } from "@/lib/client-merge-impact";

type Props = {
  clientId: string;
  companyName: string;
  /** Conteggi dei record collegati: mostrati prima di confermare. */
  impact: ClientMergeImpactRow[];
};

/**
 * Eliminazione cliente: azione a cascata e irreversibile (spariscono contratti
 * ricorrenti, opportunità vinte, ticket, contatti, asset…). Per questo vive solo
 * nella pagina di modifica — non nella lista — ed è protetta da conferma digitata.
 */
export function ClientDeleteButton({ clientId, companyName, impact }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const affected = impact.filter((r) => r.count > 0);
  const nameMatches = typed.trim() === companyName.trim();

  async function handleDelete() {
    if (!nameMatches) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        const base = data.error ?? "Eliminazione cliente non riuscita.";
        setError(data.code ? `${base} [${data.code}]` : base);
        return;
      }
      router.push("/admin/clients");
      router.refresh();
    } catch {
      setError("Eliminazione cliente non riuscita.");
    } finally {
      setLoading(false);
    }
  }

  if (!confirming) {
    return (
      <div className="flex flex-col gap-2">
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setError(null);
              setTyped("");
              setConfirming(true);
            }}
          >
            Elimina cliente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-3">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
        <p className="font-medium">L&apos;eliminazione è definitiva e non si può annullare.</p>
        {affected.length ? (
          <>
            <p className="mt-1 text-muted-foreground">Verranno eliminati o scollegati anche:</p>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 tabular-nums">
              {affected.map((r) => (
                <li key={r.label} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-medium">{r.count}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-1 text-muted-foreground">Nessun record collegato a questo cliente.</p>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">
          Per confermare, scrivi il nome esatto del cliente:{" "}
          <span className="font-medium text-foreground">{companyName}</span>
        </span>
        <Input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={companyName}
          autoComplete="off"
          aria-label="Conferma nome cliente"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={loading || !nameMatches}
        >
          {loading ? "Eliminazione…" : "Elimina definitivamente"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setConfirming(false);
            setTyped("");
            setError(null);
          }}
          disabled={loading}
        >
          Annulla
        </Button>
      </div>
    </div>
  );
}
