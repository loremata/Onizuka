"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OpportunityStatus } from "@prisma/client";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { opportunityStatusLabel } from "@/lib/crm-opportunity";
import { moveOpportunityToStatus } from "../opportunities/actions";
import { OpportunityQuickStatusForm } from "../opportunity-quick-status-form";
import { ClientLink } from "@/components/onizuka/client-link";

const COLUMNS: OpportunityStatus[] = ["OPEN", "WON", "LOST", "PAUSED"];

const MIME = "application/x-onizuka-opp";

export type PipelineBoardOpportunity = {
  id: string;
  title: string;
  status: OpportunityStatus;
  clientId: string;
  clientName: string;
  assetName: string | null;
  estimatedValue: string | null;
};

type Props = {
  opportunities: PipelineBoardOpportunity[];
};

export function PipelineBoard({ opportunities }: Props) {
  const router = useRouter();
  const [moving, setMoving] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const [dropSuccess, setDropSuccess] = useState(false);
  const [dragOver, setDragOver] = useState<OpportunityStatus | null>(null);
  const [undoMove, setUndoMove] = useState<{ id: string; from: OpportunityStatus; to: OpportunityStatus } | null>(
    null
  );
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const clear = () => setDragOver(null);
    window.addEventListener("dragend", clear);
    return () => window.removeEventListener("dragend", clear);
  }, []);

  const byStatus = useMemo(() => {
    const m = new Map<OpportunityStatus, PipelineBoardOpportunity[]>();
    for (const c of COLUMNS) m.set(c, []);
    for (const o of opportunities) {
      const list = m.get(o.status);
      if (list) list.push(o);
    }
    return m;
  }, [opportunities]);

  const onDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.setData(MIME, id);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const onDrop = useCallback(
    async (e: React.DragEvent, columnStatus: OpportunityStatus) => {
      e.preventDefault();
      setDragOver(null);
      const id = e.dataTransfer.getData(MIME);
      if (!id) return;

      const previous = opportunities.find((o) => o.id === id);
      const fromStatus = previous?.status;
      if (!fromStatus || fromStatus === columnStatus) return;

      setMoving(true);
      try {
        const res = await moveOpportunityToStatus(id, columnStatus);
        if (res && "error" in res) {
          setDropError(res.error);
          return;
        }
        setDropError(null);
        setUndoMove({ id, from: fromStatus, to: columnStatus });
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        setDropSuccess(true);
        successTimerRef.current = setTimeout(() => {
          setDropSuccess(false);
          setUndoMove(null);
          successTimerRef.current = null;
        }, 12000);
        router.refresh();
      } finally {
        setMoving(false);
      }
    },
    [router, opportunities]
  );

  const onUndo = useCallback(async () => {
    if (!undoMove) return;
    setMoving(true);
    setDropError(null);
    try {
      const res = await moveOpportunityToStatus(undoMove.id, undoMove.from);
      if (res && "error" in res) {
        setDropError(res.error);
        return;
      }
      setUndoMove(null);
      setDropSuccess(true);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        setDropSuccess(false);
        successTimerRef.current = null;
      }, 4000);
      router.refresh();
    } finally {
      setMoving(false);
    }
  }, [undoMove, router]);

  const flatOrder = useMemo(() => {
    const ids: string[] = [];
    for (const col of COLUMNS) {
      for (const o of byStatus.get(col) ?? []) ids.push(o.id);
    }
    return ids;
  }, [byStatus]);

  const moveToColumn = useCallback(
    async (id: string, columnStatus: OpportunityStatus) => {
      const previous = opportunities.find((o) => o.id === id);
      const fromStatus = previous?.status;
      if (!fromStatus || fromStatus === columnStatus) return;

      setMoving(true);
      try {
        const res = await moveOpportunityToStatus(id, columnStatus);
        if (res && "error" in res) {
          setDropError(res.error);
          return;
        }
        setDropError(null);
        setUndoMove({ id, from: fromStatus, to: columnStatus });
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        setDropSuccess(true);
        successTimerRef.current = setTimeout(() => {
          setDropSuccess(false);
          setUndoMove(null);
          successTimerRef.current = null;
        }, 12000);
        router.refresh();
      } finally {
        setMoving(false);
      }
    },
    [opportunities, router]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (flatOrder.length === 0) return;

      const idx = focusId ? flatOrder.indexOf(focusId) : -1;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = flatOrder[Math.min(idx + 1, flatOrder.length - 1)] ?? flatOrder[0];
        setFocusId(next);
        boardRef.current?.querySelector(`[data-opp-id="${next}"]`)?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = flatOrder[Math.max(idx - 1, 0)] ?? flatOrder[0];
        setFocusId(next);
        boardRef.current?.querySelector(`[data-opp-id="${next}"]`)?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (idx < 0) return;
        const current = opportunities.find((o) => o.id === flatOrder[idx]);
        if (!current) return;
        const colIdx = COLUMNS.indexOf(current.status);
        const delta = e.key === "ArrowRight" ? 1 : -1;
        const targetCol = COLUMNS[colIdx + delta];
        if (!targetCol) return;
        e.preventDefault();
        void moveToColumn(current.id, targetCol);
      } else if (e.key === "Enter" && focusId) {
        const el = boardRef.current?.querySelector(`[data-opp-id="${focusId}"] a`);
        if (el instanceof HTMLAnchorElement) {
          e.preventDefault();
          window.location.href = el.href;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flatOrder, focusId, opportunities, moveToColumn]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Tastiera: ↑↓ seleziona card, ←→ sposta colonna, Invio apre modifica.
      </p>
      {dropError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {dropError}
        </p>
      )}
      {moving && <p className="text-xs text-muted-foreground">Aggiornamento pipeline…</p>}
      {dropSuccess && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
          <span>
            Spostamento salvato
            {undoMove
              ? ` (${opportunityStatusLabel[undoMove.from]} → ${opportunityStatusLabel[undoMove.to]}).`
              : "."}
          </span>
          {undoMove ? (
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={moving} onClick={onUndo}>
              Annulla spostamento
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => {
              setDropSuccess(false);
              setUndoMove(null);
              if (successTimerRef.current) clearTimeout(successTimerRef.current);
            }}
          >
            Chiudi
          </Button>
        </div>
      )}
      <div ref={boardRef} className="grid gap-4 lg:grid-cols-4">
        {COLUMNS.map((status) => {
          const items = byStatus.get(status) ?? [];
          return (
            <Card key={status} className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{opportunityStatusLabel[status]}</CardTitle>
                <CardDescription>{items.length} opportunità</CardDescription>
              </CardHeader>
              <CardContent
                data-drop-status={status}
                onDragEnter={() => setDragOver(status)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => onDrop(e, status)}
                className={`flex min-h-[120px] flex-1 flex-col gap-2 text-sm transition-colors ${
                  dragOver === status ? "rounded-md bg-primary/5 ring-2 ring-primary/30" : ""
                }`}
              >
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Trascina qui un&apos;opportunità dalla maniglia ⋮⋮.</p>
                ) : (
                  items.map((o) => (
                    <div
                      key={o.id}
                      data-opp-id={o.id}
                      className={`rounded-md border border-border/60 bg-muted/20 p-2 ${
                        focusId === o.id ? "ring-2 ring-primary/50" : ""
                      }`}
                      onFocus={() => setFocusId(o.id)}
                      tabIndex={0}
                    >
                      <div className="flex gap-2">
                        <div
                          className="pipeline-drag-handle mt-0.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
                          draggable
                          onDragStart={(e) => onDragStart(e, o.id)}
                          tabIndex={0}
                          title="Trascina per cambiare colonna"
                          aria-label={`Trascina l'opportunità: ${o.title}`}
                        >
                          <GripVertical className="h-4 w-4" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <Link
                            className="font-medium text-primary hover:underline"
                            href={`/admin/crm/opportunities/${o.id}/edit`}
                            draggable={false}
                          >
                            {o.title}
                          </Link>
                          <p className="text-xs">
                            <ClientLink clientId={o.clientId} name={o.clientName} className="font-normal" />
                          </p>
                          {o.assetName && <p className="text-xs text-muted-foreground">Asset: {o.assetName}</p>}
                          {o.estimatedValue != null && (
                            <p className="text-xs text-muted-foreground">€ {o.estimatedValue}</p>
                          )}
                          <OpportunityQuickStatusForm opportunityId={o.id} current={o.status} layout="pipeline" />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
