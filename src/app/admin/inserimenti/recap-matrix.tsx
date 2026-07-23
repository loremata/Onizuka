"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecapMatrix } from "@/lib/inserimenti/breakdown";

const eur = (n: number) => "€ " + n.toLocaleString("it-IT", { maximumFractionDigits: 0 });

/** Tabella recap brand × categoria, con toggle pezzi / compensi. */
export function RecapMatrixTable({ matrix }: { matrix: RecapMatrix }) {
  const [metric, setMetric] = useState<"qty" | "compenso">("qty");
  const { brands, categories, cell, rowTot, colTot, grand } = matrix;
  if (!brands.length) return null;

  const fmt = (c?: { qty: number; compenso: number }) => {
    if (!c || (c.qty === 0 && c.compenso === 0)) return <span className="text-muted-foreground/40">—</span>;
    return metric === "qty" ? c.qty : eur(c.compenso);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Tabella recap</CardTitle>
            <CardDescription>Brand × categoria, con totali.</CardDescription>
          </div>
          <div className="inline-flex overflow-hidden rounded-md border text-sm">
            <button
              onClick={() => setMetric("qty")}
              className={"px-3 py-1 " + (metric === "qty" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
            >
              Pezzi
            </button>
            <button
              onClick={() => setMetric("compenso")}
              className={"px-3 py-1 " + (metric === "compenso" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
            >
              Compensi
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2 pr-4 text-left font-medium">Brand \ Categoria</th>
                {categories.map((c) => (
                  <th key={c} className="px-3 py-2 text-right font-medium">
                    {c}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-semibold">Totale</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((b) => (
                <tr key={b} className="border-b last:border-0">
                  <th className="py-2 pr-4 text-left font-medium">{b}</th>
                  {categories.map((c) => (
                    <td key={c} className="px-3 py-2 text-right">
                      {fmt(cell[b]?.[c])}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-semibold">{fmt(rowTot[b])}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2">
                <th className="py-2 pr-4 text-left font-semibold">Totale</th>
                {categories.map((c) => (
                  <td key={c} className="px-3 py-2 text-right font-semibold">
                    {fmt(colTot[c])}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-bold text-primary">{fmt(grand)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
