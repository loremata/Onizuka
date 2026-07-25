"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteFinanceEntry, markFinanceSdiExported, toggleFinanceEntryRecurring, updateFinanceEntryStatus } from "./actions";
import { FinanceRenewalDateButton } from "./finance-renewal-date-button";
import type { FinanceEntryStatus, FinanceEntryType } from "@prisma/client";

export function FinanceEntryRowActions({
  entryId,
  type,
  status,
  sdiExportedAt,
  recurringMonthly,
  renewalDate,
  sdiBridgeConfigured = false,
}: {
  entryId: string;
  type: FinanceEntryType;
  status: FinanceEntryStatus;
  sdiExportedAt?: Date | string | null;
  recurringMonthly?: boolean;
  renewalDate?: string | null;
  sdiBridgeConfigured?: boolean;
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
      <Button asChild size="sm" variant="outline">
        <Link
          href={`/api/admin/finance/${entryId}/fatturapa`}
          target="_blank"
          rel="noopener noreferrer"
          title="Bozza XML FatturaPA (Beta) — non conforme SDI, nessun invio reale"
        >
          XML
        </Link>
      </Button>
      <span
        className="self-center rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-300"
        title="Generazione XML FatturaPA / SDI in versione Beta: bozza non conforme SDI, nessun invio reale."
      >
        Beta · no invio SDI
      </span>
      {type === "INCOME" && !sdiExportedAt ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          title={
            sdiBridgeConfigured
              ? "Beta — verifica la conformità del tracciato prima dell'uso reale."
              : "Bridge SDI non configurato: nessuna trasmissione reale, segna solo un timestamp locale."
          }
          onClick={() => start(async () => { await markFinanceSdiExported(entryId); })}
        >
          {sdiBridgeConfigured ? "Segna SDI (Beta)" : "Segna SDI (solo locale)"}
        </Button>
      ) : null}
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
