"use client";

import { useState } from "react";
import Link from "next/link";
import { ITALY_TZ } from "@/lib/datetime-it";
import type { ActionInboxItem, ActionInboxKind } from "@/lib/action-inbox";
import { Card, CardContent } from "@/components/ui/card";

const kindLabel: Record<ActionInboxKind, string> = {
  flow: "Flow",
  outreach: "Reach",
  ticket: "Ticket",
  finance: "Finance",
  audit_queue: "Audit Sheet",
  post: "Contenuti",
  automation: "Automazioni",
  quote: "Preventivo",
};

const priorityClass = {
  high: "border-destructive/40 bg-destructive/5",
  medium: "border-amber-500/30 bg-amber-500/5",
  low: "border-border",
};

/** Lista azioni del giorno (Action Inbox), collassabile per non occupare tutta la home. */
export function ActionInboxCard({ items, title = "Cosa fare oggi" }: { items: ActionInboxItem[]; title?: string }) {
  const [open, setOpen] = useState(true);
  const high = items.filter((i) => i.priority === "high").length;

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-6 py-5 text-left"
      >
        <span className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-lg font-semibold leading-none tracking-tight">
            {title}
            {high > 0 ? (
              <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                {high}
              </span>
            ) : null}
          </span>
          <span className="text-sm text-muted-foreground">
            {items.length} azioni · {high} prioritarie · Flow, Reach, ticket, finance, audit, contenuti
          </span>
        </span>
        <span className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <CardContent className="pt-0">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inbox vuota. Ottimo lavoro.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${priorityClass[item.priority]}`}
                >
                  <div>
                    <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">
                      {kindLabel[item.kind]}
                    </span>
                    <Link href={item.href} className="font-medium text-primary hover:underline">
                      {item.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {item.createdAt.toLocaleString("it-IT", { timeZone: ITALY_TZ, dateStyle: "short", timeStyle: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
