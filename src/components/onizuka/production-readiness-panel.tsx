"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Item = {
  id: string;
  label: string;
  status: "done" | "optional" | "todo";
  hint?: string;
};

export function ProductionReadinessPanel() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [ready, setReady] = useState(false);

  function load() {
    fetch("/api/admin/readiness")
      .then((r) => r.json())
      .then((d: { items?: Item[]; productionReady?: boolean }) => {
        setItems(d.items ?? []);
        setReady(Boolean(d.productionReady));
      })
      .catch(() => setItems([]));
  }

  useEffect(() => {
    load();
  }, []);

  if (!items) return <p className="text-sm text-muted-foreground">Caricamento checklist…</p>;

  return (
    <div className="space-y-3 text-sm">
      <p className={ready ? "text-green-600" : "text-amber-600"}>
        {ready
          ? "Variabili obbligatorie presenti — procedi con migrate e DNS."
          : "Completa i punti obbligatori prima del go-live."}
      </p>
      <ul className="space-y-1.5">
        {items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-baseline gap-2">
            <span
              className={
                i.status === "done"
                  ? "text-green-600"
                  : i.status === "todo"
                    ? "text-destructive"
                    : "text-muted-foreground"
              }
            >
              {i.status === "done" ? "✓" : i.status === "todo" ? "○" : "·"}
            </span>
            <span>{i.label}</span>
            {i.hint ? <span className="text-xs text-muted-foreground">({i.hint})</span> : null}
          </li>
        ))}
      </ul>
      <Button type="button" size="sm" variant="outline" onClick={load}>
        Aggiorna
      </Button>
    </div>
  );
}
