"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  approveOutreachDraft,
  submitOutreachForApproval,
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

  if (status === "DRAFT") {
    return (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => start(async () => { await submitOutreachForApproval(draftId); })}
      >
        In approvazione
      </Button>
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
      </div>
    );
  }

  if (status === "APPROVED") {
    return (
      <OutreachSendButton
        draftId={draftId}
        smtpHint={smtpConfigured}
        hasAb={hasAb}
        defaultAbVariant={defaultAbVariant}
      />
    );
  }

  return null;
}
