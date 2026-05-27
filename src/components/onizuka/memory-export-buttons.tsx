"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { buildListExportHref } from "@/lib/list-export-href";

type Props = {
  q: string;
  scope?: string;
  clientId: string;
};

export function MemoryExportButtons({ q, scope, clientId }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [vaultPin, setVaultPin] = useState("");

  const maskedHref = buildListExportHref("/api/admin/memory/export", {
    q,
    scope,
    clientId,
    maskSensitive: "1",
  });

  const unmaskedHref = buildListExportHref("/api/admin/memory/export", {
    q,
    scope,
    clientId,
    maskSensitive: "0",
    confirm: "1",
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline">
        <a href={maskedHref}>Esporta CSV</a>
      </Button>
      {!confirmOpen ? (
        <Button type="button" variant="outline" onClick={() => setConfirmOpen(true)}>
          Export sensibili…
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Includere HIGH e scope SENSITIVE?</span>
          <input
            type="password"
            value={vaultPin}
            onChange={(e) => setVaultPin(e.target.value)}
            placeholder="PIN vault (se configurato)"
            className="h-8 rounded border border-input bg-background px-2 text-xs"
            autoComplete="off"
          />
          <Button asChild size="sm" variant="destructive">
            <a href={unmaskedHref}>Conferma export</a>
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmOpen(false)}>
            Annulla
          </Button>
        </div>
      )}
    </div>
  );
}
