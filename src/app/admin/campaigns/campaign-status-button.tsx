"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { setCampaignStatus } from "./actions";

type Variant = "default" | "outline" | "secondary" | "ghost" | "destructive";

function SubmitInner({ label, pendingLabel, variant }: { label: string; pendingLabel: string; variant: Variant }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * Bottone a 2 step (click → conferma) per cambiare lo stato di una campagna.
 * Fase 0: cambia solo lo status, non invia nulla ai clienti.
 */
export function CampaignStatusButton({
  campaignId,
  status,
  label,
  pendingLabel,
  question,
  variant = "default",
}: {
  campaignId: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
  label: string;
  pendingLabel: string;
  question: string;
  variant?: Variant;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" size="sm" variant={variant} onClick={() => setConfirming(true)}>
        {label}
      </Button>
    );
  }

  return (
    <form action={setCampaignStatus.bind(null, campaignId)} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="status" value={status} />
      <span className="text-xs text-muted-foreground">{question}</span>
      <SubmitInner label="Conferma" pendingLabel={pendingLabel} variant={variant} />
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Annulla
      </Button>
    </form>
  );
}
