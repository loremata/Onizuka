"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { reencryptMemoryVaultAction } from "./vault-actions";

export function MemoryVaultActions({ showReencrypt }: { showReencrypt: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (!showReencrypt) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await reencryptMemoryVaultAction();
            setMessage(
              "error" in res
                ? res.error
                : `Ri-cifrate ${res.reencrypted}/${res.processed} voci (${res.skipped} saltate).`
            );
          })
        }
      >
        {pending ? "Rotazione…" : "Ri-cifra vault (chiave corrente)"}
      </Button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  );
}
