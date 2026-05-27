"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function GoLiveSeedWarning() {
  const [weakEmails, setWeakEmails] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    fetch("/api/admin/security/seed-check")
      .then(async (res) => {
        if (!res.ok) throw new Error("check");
        return res.json() as Promise<{ ok: boolean; weakEmails: string[] }>;
      })
      .then((data) => setWeakEmails(data.weakEmails))
      .catch(() => setError("Controllo password seed non disponibile"));
  }

  useEffect(() => {
    load();
  }, []);

  if (error) {
    return (
      <p className="text-sm text-destructive">
        {error}{" "}
        <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={load}>
          Riprova
        </Button>
      </p>
    );
  }

  if (weakEmails === null) {
    return <p className="text-sm text-muted-foreground">Verifica password demo…</p>;
  }

  if (weakEmails.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nessun account con password seed predefinita rilevato.
      </p>
    );
  }

  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
      <p className="font-medium text-destructive">Password demo ancora attive</p>
      <p className="mt-1 text-muted-foreground">
        Cambia le password da{" "}
        <Link href="/admin/account/password" className="text-primary hover:underline">
          Cambia password
        </Link>{" "}
        o da{" "}
        <Link href="/admin/users" className="text-primary hover:underline">
          Utenti
        </Link>{" "}
        prima del go-live:
      </p>
      <ul className="mt-2 list-inside list-disc font-mono text-xs">
        {weakEmails.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </div>
  );
}
