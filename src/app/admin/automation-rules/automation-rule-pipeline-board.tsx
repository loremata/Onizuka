"use client";

import { useState } from "react";

const BLOCKS = [
  { id: "auto-trigger", label: "1. Trigger", hint: "Evento e priorità" },
  { id: "auto-condition", label: "2. Condizione", hint: "Filtro if/then" },
  { id: "auto-actions", label: "3. Azioni", hint: "Canali e retry" },
  { id: "auto-review", label: "4. Rivedi", hint: "Salva regola" },
] as const;

/** Pipeline drag-and-drop (riordino visuale) per guidare la creazione regola. */
export function AutomationRulePipelineBoard() {
  const [order, setOrder] = useState<string[]>(() => BLOCKS.map((b) => b.id));
  const [dragId, setDragId] = useState<string | null>(null);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="mb-4 space-y-2 rounded-md border border-dashed border-primary/30 bg-muted/30 p-3 text-sm">
      <p className="text-xs text-muted-foreground">
        Trascina i blocchi per personalizzare il flusso, poi clicca per saltare alla sezione del form.
      </p>
      <div className="flex flex-col gap-2">
        {order.map((id) => {
          const block = BLOCKS.find((b) => b.id === id)!;
          return (
            <div
              key={id}
              draggable
              onDragStart={() => setDragId(id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (!dragId || dragId === id) return;
                setOrder((prev) => {
                  const next = [...prev];
                  const from = next.indexOf(dragId);
                  const to = next.indexOf(id);
                  next.splice(from, 1);
                  next.splice(to, 0, dragId);
                  return next;
                });
                setDragId(null);
              }}
              onDragEnd={() => setDragId(null)}
              className="flex cursor-grab items-center justify-between rounded-md border bg-background px-3 py-2 active:cursor-grabbing"
            >
              <button type="button" className="text-left" onClick={() => scrollTo(block.id)}>
                <span className="font-medium">{block.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">{block.hint}</span>
              </button>
              <span className="text-xs text-muted-foreground">⠿</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
