"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function SocialMetaSyncButton({ configured }: { configured: boolean }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!configured) {
    return (
      <p className="text-xs text-muted-foreground">
        Sync Meta: imposta <span className="font-mono">META_PAGE_ACCESS_TOKEN</span> e{" "}
        <span className="font-mono">META_PAGE_ID</span>.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          start(async () => {
            const res = await fetch("/api/admin/social/sync-meta", { method: "POST" });
            const data = (await res.json()) as {
              imported?: number;
              skipped?: number;
              error?: string;
            };
            if (!res.ok) {
              setMsg(data.error ?? "Sync fallita.");
              return;
            }
            setMsg(`Importati ${data.imported ?? 0}, saltati ${data.skipped ?? 0}. Ricarica la pagina.`);
          });
        }}
      >
        Sync commenti Meta
      </Button>
      {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
    </div>
  );
}
