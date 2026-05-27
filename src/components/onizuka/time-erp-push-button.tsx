"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function TimeErpPushButton({ vendor }: { vendor?: "generic" | "zucchetti" | "teamsystem" }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="inline-flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setMessage(null);
          try {
            const res = await fetch("/api/admin/time/push-erp", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ vendor: vendor ?? "generic" }),
            });
            const data = (await res.json()) as { error?: string; entryCount?: number };
            setMessage(res.ok ? `Inviate ${data.entryCount ?? 0} voci.` : data.error ?? "Errore push.");
          } catch {
            setMessage("Errore di rete.");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Push…" : vendor ? `Push ERP ${vendor}` : "Push ERP live"}
      </Button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  );
}
