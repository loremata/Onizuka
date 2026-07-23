"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setPlanStatus } from "../actions";

/**
 * Il passaggio provvisorio → confermato è il momento in cui la lettera di gara
 * arriva e i numeri diventano veri. Finché è provvisorio, il cruscotto marca i
 * compensi come stima.
 */
export function StatoPiano({
  planId,
  status,
  notes,
}: {
  planId: string;
  status: string;
  notes: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function change(next: "PROVISIONAL" | "ACTIVE" | "ARCHIVED") {
    setBusy(true);
    await setPlanStatus(planId, next);
    setBusy(false);
    router.refresh();
  }

  if (status === "PROVISIONAL") {
    return (
      <div className="rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-3 dark:bg-amber-950/40">
        <p className="text-sm text-amber-900 dark:text-amber-200">
          <strong>Piano provvisorio.</strong> {notes ?? "Duplicato dal mese precedente."} Il cruscotto mostra i compensi
          come stima finché non lo confermi.
        </p>
        <Button size="sm" className="mt-2" onClick={() => change("ACTIVE")} disabled={busy}>
          {busy ? "…" : "Conferma: la lettera è arrivata"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <span>
        Piano <strong className="text-foreground">{status === "ACTIVE" ? "confermato" : "archiviato"}</strong>.
      </span>
      {status === "ACTIVE" ? (
        <Button size="sm" variant="ghost" onClick={() => change("PROVISIONAL")} disabled={busy}>
          Rimetti in provvisorio
        </Button>
      ) : null}
    </div>
  );
}
