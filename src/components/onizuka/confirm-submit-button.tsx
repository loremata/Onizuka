"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

function SubmitInner({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" size="sm" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * Bottone di azione distruttiva a 2 step da usare DENTRO un <form action={...}>:
 * primo click chiede conferma, il secondo invia. Evita cancellazioni accidentali
 * (prima molti delete partivano al primo click).
 */
export function ConfirmSubmitButton({
  label = "Elimina",
  confirmLabel = "Conferma",
  pendingLabel = "Eliminazione…",
  question = "Confermi l'eliminazione?",
}: {
  label?: string;
  confirmLabel?: string;
  pendingLabel?: string;
  question?: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="destructive" size="sm" onClick={() => setConfirming(true)}>
        {label}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">{question}</span>
      <SubmitInner label={confirmLabel} pendingLabel={pendingLabel} />
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Annulla
      </Button>
    </div>
  );
}
