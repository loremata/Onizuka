"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function TimeCertifiedPushButtons() {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function push(vendor: "zucchetti" | "sap") {
    setMsg(null);
    start(async () => {
      const res = await fetch(`/api/admin/time/push-certified?vendor=${vendor}`, { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      setMsg(data.message ?? data.error ?? (res.ok ? "OK" : "Errore"));
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-300"
        title="Push ERP certificato non attivo: integrazione sperimentale, richiede endpoint/credenziali partner."
      >
        Sperimentale — integrazione non attiva
      </span>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => push("zucchetti")}>
        Push API Zucchetti
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => push("sap")}>
        Push API SAP
      </Button>
      {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
    </div>
  );
}
