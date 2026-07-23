"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { setMonthlyGoal } from "./actions";

import { eur0 as eur } from "@/lib/inserimenti/format";

/**
 * Obiettivo personale di compensi del mese. È una cosa che ti dai tu, distinta
 * dai target di gara che ti dà TIM: per questo si calcola sul TOTALE GENERALE
 * (tutti i brand), non sulle singole gare.
 */
export function Obiettivo({
  month,
  goal,
  total,
  daysLeft,
  daysInMonth,
}: {
  month: string;
  goal: number;
  total: number;
  daysLeft: number;
  daysInMonth: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goal ? String(goal) : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await setMonthlyGoal(month, draft);
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Obiettivo del mese</CardTitle>
          <CardDescription>Vale sul totale di tutti i brand. Metti 0 per toglierlo.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <input
            autoFocus
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            placeholder="es. 3000"
            className="w-32 rounded-md border bg-background px-3 py-2 text-sm"
          />
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Salvo…" : "Salva"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Annulla
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!goal) {
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 py-4">
          <CardDescription>Nessun obiettivo per questo mese.</CardDescription>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Imposta obiettivo
          </Button>
        </CardHeader>
      </Card>
    );
  }

  const pct = Math.round((total / goal) * 100);
  const done = total >= goal;
  const manca = Math.max(0, goal - total);
  const alGiorno = daysLeft > 0 ? manca / daysLeft : manca;
  // proiezione a fine mese col ritmo tenuto finora
  const giorniFatti = daysInMonth - daysLeft;
  const proiezione = giorniFatti > 0 ? (total / giorniFatti) * daysInMonth : total;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">Obiettivo del mese</CardTitle>
          <CardDescription>
            {eur(total)} di {eur(goal)}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <span className={"text-lg font-semibold tabular-nums " + (done ? "text-green-600" : "")}>
            {done ? "🎯 " : ""}
            {pct}%
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(String(goal));
              setEditing(true);
            }}
          >
            Modifica
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={"h-full rounded-full " + (done ? "bg-green-600" : "bg-primary")}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {done ? (
            <>Obiettivo raggiunto · {eur(total - goal)} oltre il target.</>
          ) : daysLeft > 0 ? (
            <>
              Mancano <strong>{eur(manca)}</strong> · {daysLeft} giorni ({eur(alGiorno)}/giorno). Al ritmo attuale:{" "}
              <strong>{eur(proiezione)}</strong>{" "}
              <span className={proiezione >= goal ? "text-green-600" : "text-amber-600"}>
                {proiezione >= goal ? "▲ sopra obiettivo" : "▼ sotto obiettivo"}
              </span>
            </>
          ) : (
            <>
              Mancano <strong>{eur(manca)}</strong> · mese chiuso.
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
