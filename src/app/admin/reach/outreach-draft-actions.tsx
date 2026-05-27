"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { approveOutreachDraft, markOutreachSent, submitOutreachForApproval } from "./actions";
import { OutreachSendButton } from "./outreach-mailto-button";
import type { OutreachAbVariant } from "@/lib/outreach-ab";

const labels: Record<string, string> = {
  DRAFT: "Bozza",
  PENDING_APPROVAL: "In approvazione",
  APPROVED: "Approvata",
  SENT: "Inviata",
  CANCELLED: "Annullata",
};

export function OutreachDraftActions({
  id,
  status,
  smtpConfigured,
  hasAb,
  abVariantSent,
  defaultAbVariant = "A",
}: {
  id: string;
  status: string;
  smtpConfigured?: boolean;
  hasAb?: boolean;
  abVariantSent?: string | null;
  defaultAbVariant?: OutreachAbVariant;
}) {
  const [pending, start] = useTransition();
  const [variant, setVariant] = useState<OutreachAbVariant>(defaultAbVariant);

  return (
    <div className="flex flex-wrap gap-1">
      <span className="text-xs text-muted-foreground">
        {labels[status] ?? status}
        {abVariantSent ? ` · variante ${abVariantSent}` : ""}
      </span>
      {status === "DRAFT" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={pending}
          onClick={() => start(async () => { await submitOutreachForApproval(id); })}
        >
          Invia in approvazione
        </Button>
      ) : null}
      {status === "PENDING_APPROVAL" ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 text-xs"
          disabled={pending}
          onClick={() => start(async () => { await approveOutreachDraft(id); })}
        >
          Approva
        </Button>
      ) : null}
      {status === "APPROVED" ? (
        <OutreachSendButton
          draftId={id}
          smtpHint={smtpConfigured}
          hasAb={hasAb}
          defaultAbVariant={defaultAbVariant}
        />
      ) : null}
      {status === "APPROVED" || status === "PENDING_APPROVAL" ? (
        <>
          {hasAb ? (
            <select
              value={variant}
              onChange={(e) => setVariant(e.target.value as OutreachAbVariant)}
              className="h-7 rounded border border-input bg-background px-1 text-xs"
              disabled={pending}
              aria-label="Variante per segna inviata"
            >
              <option value="A">A</option>
              <option value="B">B</option>
            </select>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={pending}
            onClick={() => start(async () => { await markOutreachSent(id, hasAb ? variant : undefined); })}
          >
            Segna inviata
          </Button>
        </>
      ) : null}
    </div>
  );
}
