"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteSale } from "../actions";

interface Row {
  id: string;
  date: string;
  brand: string;
  lineKey: string;
  feeEur: number | null;
  domiciled: boolean;
}

export function RecentSales({ sales }: { sales: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  if (!sales.length) return <p className="text-sm text-muted-foreground">Ancora nessuna vendita questo mese.</p>;

  async function remove(id: string) {
    setBusy(id);
    await deleteSale(id);
    setBusy(null);
    router.refresh();
  }

  return (
    <ul className="divide-y text-sm">
      {sales.map((s) => (
        <li key={s.id} className="flex items-center gap-3 py-2">
          <span className="w-16 shrink-0 text-xs text-muted-foreground">{s.date.slice(5)}</span>
          <span className="flex-1">
            <span className="font-medium">{s.brand}</span> · {s.lineKey}
            {s.feeEur != null ? ` · ${s.feeEur.toLocaleString("it-IT")} €` : ""}
            {s.domiciled ? " · dom." : ""}
          </span>
          <button
            onClick={() => remove(s.id)}
            disabled={busy === s.id}
            className="shrink-0 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-red-600"
            aria-label="Elimina"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}
