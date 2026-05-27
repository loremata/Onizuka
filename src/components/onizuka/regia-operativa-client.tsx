"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RegiaKpiBundle } from "@/lib/regia-kpi";

type Props = {
  initialDay: string;
  initialPayload: Record<string, unknown>;
  initialKpi: RegiaKpiBundle;
};

export function RegiaOperativaClient({ initialDay, initialPayload, initialKpi }: Props) {
  const [day, setDay] = useState(initialDay);
  const [kpi, setKpi] = useState(initialKpi);
  const [priorities, setPriorities] = useState(String(initialPayload.priorities ?? ""));
  const [calls, setCalls] = useState(String(initialPayload.calls ?? ""));
  const [blockers, setBlockers] = useState(String(initialPayload.blockers ?? ""));
  const [notes, setNotes] = useState(String(initialPayload.notes ?? ""));
  const [saving, setSaving] = useState(false);
  const [closed, setClosed] = useState(false);

  const loadDay = useCallback(async (isoDay: string) => {
    const [sheetRes, kpiRes] = await Promise.all([
      fetch(`/api/admin/regia/daily-sheet?day=${isoDay}`),
      fetch("/api/admin/regia/kpi"),
    ]);
    if (sheetRes.ok) {
      const j = (await sheetRes.json()) as { payload?: Record<string, unknown> };
      const p = j.payload ?? {};
      setPriorities(String(p.priorities ?? ""));
      setCalls(String(p.calls ?? ""));
      setBlockers(String(p.blockers ?? ""));
      setNotes(String(p.notes ?? ""));
    }
    if (kpiRes.ok) {
      const j = (await kpiRes.json()) as { kpi?: RegiaKpiBundle };
      if (j.kpi) setKpi(j.kpi);
    }
  }, []);

  useEffect(() => {
    if (day !== initialDay) void loadDay(day);
  }, [day, initialDay, loadDay]);

  async function save(closeDay?: boolean) {
    setSaving(true);
    await fetch("/api/admin/regia/daily-sheet", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        day,
        closed: closeDay,
        payload: { priorities, calls, blockers, notes },
      }),
    });
    setSaving(false);
    if (closeDay) setClosed(true);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="day">Giorno regia</Label>
          <Input id="day" type="date" value={day} onChange={(e) => setDay(e.target.value)} className="w-auto" />
        </div>
        <Button type="button" disabled={saving} onClick={() => save(false)}>
          {saving ? "Salvataggio…" : "Salva agenda"}
        </Button>
        <Button type="button" variant="secondary" disabled={saving} onClick={() => save(true)}>
          Chiudi giornata
        </Button>
        {closed ? <span className="text-xs text-emerald-600">Giornata chiusa</span> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Lead settimana</p>
          <p className="text-xl font-bold">{kpi.business.leadNuovi}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Convertiti</p>
          <p className="text-xl font-bold">{kpi.business.leadConvertiti}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Pipeline €</p>
          <p className="text-xl font-bold">{kpi.business.valorePipelineEur}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Follow-up oggi</p>
          <p className="text-xl font-bold">{kpi.operational.followUpOggi}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <Label>Priorità del giorno</Label>
          <textarea
            value={priorities}
            onChange={(e) => setPriorities(e.target.value)}
            rows={4}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label>Chiamate / appuntamenti</Label>
          <textarea
            value={calls}
            onChange={(e) => setCalls(e.target.value)}
            rows={4}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label>Blocchi</Label>
          <textarea
            value={blockers}
            onChange={(e) => setBlockers(e.target.value)}
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label>Note</Label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Settimana {kpi.weekStart} → {kpi.weekEnd} ·{" "}
        <Link href="/admin/crm/leads" className="text-primary hover:underline">
          Lead
        </Link>{" "}
        ·{" "}
        <Link href="/admin/intelligence" className="text-primary hover:underline">
          Intelligence
        </Link>
      </p>
    </div>
  );
}
