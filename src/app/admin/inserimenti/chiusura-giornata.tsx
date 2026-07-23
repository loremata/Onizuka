"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Today {
  date: string;
  qty: number;
  byBrand: { name: string; qty: number }[];
}

/** Riepilogo della giornata, copiabile in un tap: serve a chiudere il banco. */
export function ChiusuraGiornata({ today }: { today: Today }) {
  const [copied, setCopied] = useState(false);

  const testo =
    `Online Station — chiusura ${today.date.split("-").reverse().join("/")}\n` +
    `Attivazioni: ${today.qty}\n` +
    today.byBrand.map((b) => `${b.name}: ${b.qty}`).join(" · ");

  async function copia() {
    try {
      await navigator.clipboard.writeText(testo);
    } catch {
      // fallback per browser/contesti senza clipboard API
      const ta = document.createElement("textarea");
      ta.value = testo;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">Chiusura giornata</CardTitle>
          <CardDescription>{today.qty} attivazioni oggi</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={copia}>
          {copied ? "Copiato ✓" : "Copia"}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {today.byBrand.map((b) => (
            <span key={b.name} className="rounded-full border px-3 py-1 text-xs">
              {b.name} <strong className="tabular-nums">{b.qty}</strong>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
