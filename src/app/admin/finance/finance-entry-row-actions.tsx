"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteFinanceEntry, toggleFinanceEntryRecurring, updateFinanceEntryStatus } from "./actions";
import { FinanceRenewalDateButton } from "./finance-renewal-date-button";
import type { FinanceEntryStatus, FinanceEntryType } from "@prisma/client";

export function FinanceEntryRowActions({
  entryId,
  type,
  status,
  recurringMonthly,
  renewalDate,
}: {
  entryId: string;
  type: FinanceEntryType;
  status: FinanceEntryStatus;
  recurringMonthly?: boolean;
  renewalDate?: string | null;
}) {
  const [pending, start] = useTransition();

  const markDone = type === "INCOME" ? "RECEIVED" : "PAID";

  return (
    <div className="flex flex-wrap gap-1">
      <Button asChild size="sm" variant="outline">
        <Link href={`/api/admin/finance/${entryId}/pdf`} target="_blank" rel="noopener noreferrer">
          PDF
        </Link>
      </Button>
      {type === "INCOME" ? (
        <Button
          type="button"
          size="sm"
          variant={recurringMonthly ? "default" : "outline"}
          disabled={pending}
          onClick={() => start(async () => { await toggleFinanceEntryRecurring(entryId); })}
        >
          MRR {recurringMonthly ? "on" : "off"}
        </Button>
      ) : null}
      {type === "INCOME" && recurringMonthly ? (
        <FinanceRenewalDateButton entryId={entryId} renewalDate={renewalDate ?? null} />
      ) : null}
      {status !== markDone ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => start(async () => { await updateFinanceEntryStatus(entryId, markDone); })}
        >
          Segna {type === "INCOME" ? "incassato" : "pagato"}
        </Button>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => start(async () => { await deleteFinanceEntry(entryId); })}
      >
        Elimina
      </Button>
    </div>
  );
}
