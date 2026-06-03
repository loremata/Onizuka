"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  approveOutreachDraft,
  submitOutreachForApproval,
  archiveOutreachDraft,
} from "@/app/admin/reach/actions";
import { OutreachSendButton } from "@/app/admin/reach/outreach-mailto-button";
import type { OutreachAbVariant } from "@/lib/outreach-ab";

type Props = {
  draftId: string;
  status: string;
  smtpConfigured: boolean;
  hasAb: boolean;
  defaultAbVariant?: OutreachAbVariant;
};

export function ApprovalQueueOutreachActions({
  draftId,
  status,
  smtpConfigured,
  hasAb,
  defaultAbVariant = "A",
}: Props) {
  const [pending, start] = useTransition();

  const archiveButton = (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      title="Archivia: toglie la bozza dalla coda senza inviarla"
      onClick={() => start(async () => { await archiveOutreachDraft(draftId); })}
    >
      Archivia
    </Button>
  );

  if (status === "DRAFT") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => start(async () => { await submitOutreachForApproval(draftId); })}
        >
          In approvazione
        </Button>
        {archiveButton}
      </div>
    );
  }

  if (status === "PENDING_APPROVAL") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => start(async () => { await approveOutreachDraft(draftId); })}
        >
          Approva
        </Button>
        <OutreachSendButton
          draftId={draftId}
          smtpHint={smtpConfigured}
          hasAb={hasAb}
          defaultAbVariant={defaultAbVariant}
        />
        {archiveButton}
      </div>
    );
  }

  if (status === "APPROVED") {
    return (
      <div className="flex flex-wrap gap-2">
        <OutreachSendButton
          draftId={draftId}
          smtpHint={smtpConfigured}
          hasAb={hasAb}
          defaultAbVariant={defaultAbVariant}
        />
        {archiveButton}
      </div>
    );
  }

  return null;
}
