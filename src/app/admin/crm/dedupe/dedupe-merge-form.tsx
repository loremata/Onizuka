"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { assertMergeClientsAllowed } from "@/lib/client-merge-guard";
import { duplicatePairScore } from "@/lib/client-dedupe-score";
import { listMergeFieldConflicts } from "@/lib/client-merge-fields";
import { getMergeImpactPairAction, mergeClientsAction } from "./actions";
import { Select } from "@/components/ui/select";

type ClientOpt = {
  id: string;
  companyName: string;
  vatNumber: string | null;
  contactEmail: string;
  phone: string | null;
};

const fieldLabels: Record<string, string> = {
  companyName: "Ragione sociale",
  contactEmail: "Email contatto",
  vatNumber: "P.IVA",
  phone: "Telefono",
};

export function DedupeMergeForm({ clients }: { clients: ClientOpt[] }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [targetId, setTargetId] = useState(clients[0]?.id ?? "");
  const [sourceId, setSourceId] = useState(clients[1]?.id ?? "");
  const [impact, setImpact] = useState<Awaited<ReturnType<typeof getMergeImpactPairAction>> | null>(null);

  const target = clients.find((c) => c.id === targetId);
  const source = clients.find((c) => c.id === sourceId);
  const mergeGuard = target && source ? assertMergeClientsAllowed(target, source) : { ok: true as const };
  const blocked = mergeGuard.ok ? null : mergeGuard.error;
  const conflicts =
    target && source ? listMergeFieldConflicts(target, source) : [];
  const pairScore =
    target && source
      ? duplicatePairScore(
          { companyName: target.companyName, contactEmail: target.contactEmail, vatNumber: target.vatNumber, phone: target.phone },
          { companyName: source.companyName, contactEmail: source.contactEmail, vatNumber: source.vatNumber, phone: source.phone }
        )
      : 0;

  useEffect(() => {
    if (!targetId || !sourceId || targetId === sourceId) {
      setImpact(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await getMergeImpactPairAction(targetId, sourceId);
      if (!cancelled) setImpact(res);
    })();
    return () => {
      cancelled = true;
    };
  }, [targetId, sourceId]);

  return (
    <form
      className="mt-3 space-y-2 rounded-md border border-border/60 bg-muted/20 p-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("merge_targetId", targetId);
        fd.set("merge_sourceId", sourceId);
        start(async () => {
          const res = await mergeClientsAction(targetId, sourceId, fd);
          setMessage(res.ok ? "Merge completato." : res.error);
        });
      }}
    >
      <p className="text-xs text-muted-foreground">
        Wizard merge: anteprima FK e scelta valori in conflitto; la sorgente viene eliminata dopo lo spostamento.
        {pairScore > 0 ? (
          <span className="ml-1 font-medium text-foreground">
            · Score duplicato: {pairScore}%
          </span>
        ) : null}
      </p>
      <label className="block">
        <span className="text-xs font-medium">Destinazione (mantieni)</span>
        <Select
          className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </Select>
      </label>
      <label className="block">
        <span className="text-xs font-medium">Sorgente (elimina dopo merge)</span>
        <Select
          className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </Select>
      </label>
      {blocked ? <p className="text-xs text-destructive">{blocked}</p> : null}
      {target && source && conflicts.length > 0 ? (
        <div className="space-y-2 rounded border border-primary/20 bg-primary/5 p-2 text-xs">
          <p className="font-medium">Risolvi conflitti (valore da mantenere)</p>
          {conflicts.map((key) => (
            <div key={key} className="flex flex-wrap items-center gap-3">
              <span className="min-w-[100px] font-medium">{fieldLabels[key] ?? key}</span>
              <label className="flex items-center gap-1">
                <input type="radio" name={`merge_${key}`} value="target" defaultChecked />
                Dest: {(target[key] as string | null) ?? "—"}
              </label>
              <label className="flex items-center gap-1">
                <input type="radio" name={`merge_${key}`} value="source" />
                Sorg: {(source[key] as string | null) ?? "—"}
              </label>
            </div>
          ))}
        </div>
      ) : null}
      {impact && impact.ok ? (
        <div className="grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded border border-border/50 bg-background/80 p-2">
            <p className="font-medium text-foreground">Destinazione · record collegati</p>
            <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto text-muted-foreground">
              {impact.target.map((r) => (
                <li key={r.label}>
                  {r.label}: <strong>{r.count}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2">
            <p className="font-medium text-foreground">Sorgente · verso destinazione</p>
            <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto text-muted-foreground">
              {impact.source.map((r) => (
                <li key={r.label}>
                  {r.label}: <strong>{r.count}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : impact && !impact.ok ? (
        <p className="text-xs text-destructive">{impact.error}</p>
      ) : null}
      <Button
        type="submit"
        size="sm"
        variant="destructive"
        disabled={pending || !targetId || !sourceId || targetId === sourceId || !!blocked}
      >
        {pending ? "…" : "Esegui merge"}
      </Button>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </form>
  );
}
