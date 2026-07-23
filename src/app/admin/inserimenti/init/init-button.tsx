"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { initInserimentiStep } from "./actions";

/**
 * Pulsante di go-live: chiama l'action a blocchi finché non ha applicato tutti
 * gli statement. Sicuro da ripremere (tutto idempotente lato server).
 */
export function InitButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ next: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    setDoneMsg(null);
    let offset = 0;
    let applied = 0;
    let skipped = 0;
    // a blocchi: ogni chiamata applica ~50 statement, così nessun timeout serverless
    for (let guard = 0; guard < 40; guard++) {
      const res = await initInserimentiStep(offset);
      applied += res.applied;
      skipped += res.skipped;
      setProgress({ next: res.next, total: res.total });
      if (res.error) {
        setError(res.error + " — Puoi ripremere il pulsante: riparte da dove si è fermato, senza duplicare.");
        setRunning(false);
        return;
      }
      if (res.done) {
        setDoneMsg(`Fatto: ${applied} statement applicati, ${skipped} già presenti.`);
        setRunning(false);
        router.refresh();
        return;
      }
      offset = res.next;
    }
    setError("Interrotto per sicurezza dopo troppi blocchi: ripremi per continuare.");
    setRunning(false);
  }

  return (
    <div className="space-y-3">
      <Button onClick={run} disabled={running}>
        {running
          ? `Inizializzo… ${progress ? Math.round((progress.next / progress.total) * 100) + "%" : ""}`
          : "Inizializza modulo Inserimenti"}
      </Button>
      {progress && running ? (
        <div className="h-2 max-w-sm overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(progress.next / progress.total) * 100}%` }}
          />
        </div>
      ) : null}
      {doneMsg ? <p className="text-sm text-green-700 dark:text-green-400">✓ {doneMsg}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
