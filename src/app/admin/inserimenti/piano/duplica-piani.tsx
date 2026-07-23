"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { duplicatePlans } from "./actions";

export function DuplicaPiani({ fromMonth, toMonth }: { fromMonth: string; toMonth: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    const res = await duplicatePlans(fromMonth, toMonth);
    setBusy(false);
    if ("error" in res) {
      setMsg(res.error);
      return;
    }
    setMsg(
      res.count === 0
        ? `Nessun piano copiato: su ${toMonth} esistevano già.`
        : `${res.count} piani copiati su ${toMonth}, in stato provvisorio.`,
    );
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Button size="sm" onClick={run} disabled={busy}>
        {busy ? "Copio…" : `Duplica ${fromMonth} → ${toMonth}`}
      </Button>
      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
    </div>
  );
}
