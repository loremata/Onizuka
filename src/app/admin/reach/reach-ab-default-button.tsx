"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { applyReachAbDefaultAction } from "./actions";

export function ReachAbDefaultButton({
  suggestedWinner,
  currentDefault,
}: {
  suggestedWinner?: string | null;
  currentDefault?: string | null;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (!suggestedWinner) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {currentDefault ? (
        <span className="text-muted-foreground">Default invii: variante {currentDefault}</span>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="h-7"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await applyReachAbDefaultAction();
            setMessage("error" in res ? res.error : `Default impostato: variante ${res.variant}`);
          })
        }
      >
        {pending ? "…" : `Usa vincitore ${suggestedWinner} per nuovi invii`}
      </Button>
      {message ? <span className="text-muted-foreground">{message}</span> : null}
    </div>
  );
}
