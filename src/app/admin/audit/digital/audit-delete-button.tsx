"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteDigitalAudit } from "./actions";

export function AuditDeleteButton({ auditId, label }: { auditId: string; label: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Eliminare «{label}»?</span>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => start(async () => { await deleteDigitalAudit(auditId); })}
        >
          {pending ? "Elimino…" : "Conferma"}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
          Annulla
        </Button>
      </span>
    );
  }

  return (
    <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(true)}>
      Elimina
    </Button>
  );
}
