"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { QuoteLine } from "@/lib/quote-lines";
import { computeQuoteTotals, formatEur } from "@/lib/quote-lines";

const emptyLine = (): QuoteLine => ({ description: "", quantity: 1, unitPrice: 0 });

export function QuoteLinesEditor({
  name,
  defaultLines,
  taxPercentDefault = 22,
}: {
  name: string;
  defaultLines?: QuoteLine[];
  taxPercentDefault?: number;
}) {
  const [lines, setLines] = useState<QuoteLine[]>(
    defaultLines?.length ? defaultLines : [emptyLine(), emptyLine()]
  );
  const [taxPercent, setTaxPercent] = useState(taxPercentDefault);

  const linesJson = useMemo(() => JSON.stringify(lines.filter((l) => l.description.trim())), [lines]);
  const totals = useMemo(
    () => computeQuoteTotals(lines.filter((l) => l.description.trim()), taxPercent),
    [lines, taxPercent]
  );

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={linesJson} readOnly />
      {lines.map((line, i) => (
        <div key={i} className="grid gap-2 rounded-md border border-border/60 p-2 sm:grid-cols-12">
          <Input
            className="sm:col-span-6"
            placeholder="Descrizione"
            value={line.description}
            onChange={(e) => {
              const next = [...lines];
              next[i] = { ...next[i], description: e.target.value };
              setLines(next);
            }}
          />
          <Input
            className="sm:col-span-2"
            type="number"
            min={0.01}
            step="0.01"
            placeholder="Q.tà"
            value={line.quantity}
            onChange={(e) => {
              const next = [...lines];
              next[i] = { ...next[i], quantity: Number(e.target.value) };
              setLines(next);
            }}
          />
          <Input
            className="sm:col-span-3"
            type="number"
            min={0}
            step="0.01"
            placeholder="Prezzo €"
            value={line.unitPrice || ""}
            onChange={(e) => {
              const next = [...lines];
              next[i] = { ...next[i], unitPrice: Number(e.target.value) };
              setLines(next);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="sm:col-span-1"
            onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
          >
            ×
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => setLines([...lines, emptyLine()])}>
        + Riga
      </Button>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <div>
          <label className="text-xs text-muted-foreground">IVA %</label>
          <Input
            name="taxPercent"
            type="number"
            min={0}
            max={100}
            className="mt-1 w-24"
            value={taxPercent}
            onChange={(e) => setTaxPercent(Number(e.target.value))}
          />
        </div>
        <p className="text-muted-foreground">
          Imponibile {formatEur(totals.subtotal)} · IVA {formatEur(totals.tax)} ·{" "}
          <strong className="text-foreground">Totale {formatEur(totals.total)}</strong>
        </p>
      </div>
    </div>
  );
}
