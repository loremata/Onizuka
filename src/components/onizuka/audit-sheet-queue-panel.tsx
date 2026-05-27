"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { processAuditSheetQueueAction, syncAuditSheetFromGoogle } from "@/app/admin/audit/digital/actions";

type Props = {
  pending: number;
  failed: number;
  sheetConfigured: boolean;
};

export function AuditSheetQueuePanel({ pending, failed, sheetConfigured }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [pendingTx, start] = useTransition();

  function run(
    action: () => Promise<
      | { error: string }
      | {
          parsed?: number;
          enqueued?: number;
          skipped?: number;
          rejected?: { rowIndex: number; reason: string }[];
          processed?: number;
          done?: number;
          failed?: number;
        }
    >
  ) {
    setMessage(null);
    start(async () => {
      const res = await action();
      if ("error" in res) setMessage(String(res.error));
      else {
        const rejected = res.rejected?.length
          ? ` · ${res.rejected.length} righe scartate`
          : "";
        setMessage(`${JSON.stringify(res)}${rejected}`);
      }
    });
  }

  return (
    <div className="space-y-3 text-sm">
      {!sheetConfigured ? (
        <p className="text-muted-foreground">
          Configura <code className="text-xs">GOOGLE_SHEET_AUDIT_CSV_URL</code>,{" "}
          <code className="text-xs">GOOGLE_SHEET_AUDIT_SPREADSHEET_ID</code> + service account Sheets API.
        </p>
      ) : null}
      <p className="text-muted-foreground">
        Coda: <span className="font-semibold text-foreground">{pending}</span> in attesa
        {failed > 0 ? (
          <>
            {" "}
            · <span className="text-destructive">{failed}</span> falliti
          </>
        ) : null}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pendingTx || !sheetConfigured}
          onClick={() => run(() => syncAuditSheetFromGoogle())}
        >
          Importa da Sheet
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={pendingTx || pending === 0}
          onClick={() => run(() => processAuditSheetQueueAction(5))}
        >
          Elabora 5 in coda
        </Button>
      </div>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
