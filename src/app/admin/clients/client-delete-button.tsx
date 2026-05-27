"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Props = { clientId: string; companyName: string };

export function ClientDeleteButton({ clientId, companyName }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete() {
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
      setError(null);
      setConfirming(false);
      router.refresh();
    } catch {
      setError("Eliminazione cliente non riuscita.");
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex max-w-md flex-col gap-2">
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Eliminare &quot;{companyName}&quot;?</span>
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={loading}>
            {loading ? "Eliminazione…" : "Sì"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setConfirming(false);
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

  return (
    <div className="flex max-w-md flex-col items-end gap-2">
      {error ? (
        <p className="w-full text-right text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        variant="destructive"
        size="sm"
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
      >
        Elimina
      </Button>
    </div>
  );
}
