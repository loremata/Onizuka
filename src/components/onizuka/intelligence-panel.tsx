"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { IntelligenceItem } from "@/lib/intelligence-nba";

export function IntelligencePanel({ initialItems }: { initialItems: IntelligenceItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    const res = await fetch("/api/admin/intelligence/refresh", { method: "POST" });
    setRefreshing(false);
    if (res.ok) {
      const j = (await res.json()) as { items?: IntelligenceItem[] };
      if (j.items) setItems(j.items);
    }
  }

  async function dismiss(id: string) {
    await fetch(`/api/admin/intelligence/${id}/dismiss`, { method: "POST" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const priorityClass: Record<string, string> = {
    high: "border-destructive/40",
    medium: "border-amber-500/30",
    low: "border-border",
  };

  return (
    <div className="space-y-4">
      <Button type="button" onClick={refresh} disabled={refreshing}>
        {refreshing ? "Aggiornamento…" : "Rigenera raccomandazioni"}
      </Button>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessuna raccomandazione attiva. Clicca rigenera.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className={`rounded-md border px-4 py-3 text-sm ${priorityClass[item.priority] ?? ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={item.href} className="font-medium text-primary hover:underline">
                    {item.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                  <p className="mt-1 text-[10px] uppercase text-muted-foreground">
                    {item.kind} · {item.priority}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => dismiss(item.id)}>
                  Ignora
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
