"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import type { FinanceReconciliationRow } from "@/lib/finance-reconciliation";
import { runFinanceReconciliationFix } from "./reconciliation-actions";

const FIXABLE: Record<string, { label: string; fixId: "received_no_paid_at" | "paid_status_mismatch" }> = {
  received_no_paid_at: {
    label: "Imposta data pagamento (oggi o scadenza)",
    fixId: "received_no_paid_at",
  },
  paid_status_mismatch: {
    label: "Allinea stato a incassato/pagato",
    fixId: "paid_status_mismatch",
  },
};

export function FinanceReconciliationActions({ rows }: { rows: FinanceReconciliationRow[] }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const fixable = rows.filter((r) => r.severity !== "ok" && r.count > 0 && FIXABLE[r.id]);

  if (fixable.length === 0) return null;

  return (
    <div className="mt-4 space-y-2 border-t border-border pt-3">
      <p className="text-xs font-medium text-muted-foreground">Correzioni rapide</p>
      <div className="flex flex-wrap gap-2">
        {fixable.map((row) => {
          const action = FIXABLE[row.id]!;
          return (
            <Button
              key={row.id}
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await runFinanceReconciliationFix(action.fixId);
                  setMessage(
                    res.ok
                      ? `Corrette ${res.fixed} voci (${row.label}).`
                      : res.error
                  );
                })
              }
            >
              {action.label} ({row.count})
            </Button>
          );
        })}
      </div>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
