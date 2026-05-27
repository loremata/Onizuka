"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { flowGraphToRuleSnapshot, type AutomationFlowGraph, type FlowNode } from "@/lib/automation-flow-graph";
import { importAutomationRuleFromJson } from "./actions";
import type { AutomationRuleTrigger } from "@prisma/client";

const DEFAULT_NODES: FlowNode[] = [
  { id: "t1", type: "trigger", label: "LEAD_CREATED", x: 40, y: 40 },
  { id: "c1", type: "condition", label: "Filtro", x: 200, y: 40 },
  { id: "a1", type: "telegram", label: "Telegram", x: 360, y: 20 },
  { id: "a2", type: "email", label: "Email SMTP", x: 360, y: 80 },
];

export function AutomationFlowBuilder() {
  const [nodes, setNodes] = useState<FlowNode[]>(DEFAULT_NODES);
  const [edges, setEdges] = useState([{ from: "t1", to: "c1" }, { from: "c1", to: "a1" }, { from: "c1", to: "a2" }]);
  const [message, setMessage] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  function exportJson() {
    const triggerLabel = nodes.find((n) => n.type === "trigger")?.label ?? "LEAD_CREATED";
    const graph: AutomationFlowGraph = {
      nodes,
      edges,
      meta: {
        name: "Flusso visuale",
        trigger: triggerLabel as AutomationRuleTrigger,
      },
    };
    const snap = flowGraphToRuleSnapshot(graph);
    return JSON.stringify({ rule: snap }, null, 2);
  }

  return (
    <div className="space-y-4">
      <div className="relative min-h-[280px] rounded-md border bg-muted/20 p-4">
        {nodes.map((n) => (
          <div
            key={n.id}
            draggable
            onDragStart={() => setDragId(n.id)}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!dragId || dragId === n.id) return;
              const rect = e.currentTarget.parentElement?.getBoundingClientRect();
              if (!rect) return;
              setNodes((prev) =>
                prev.map((node) =>
                  node.id === dragId
                    ? {
                        ...node,
                        x: Math.max(0, e.clientX - rect.left - 60),
                        y: Math.max(0, e.clientY - rect.top - 20),
                      }
                    : node
                )
              );
            }}
            className="absolute cursor-grab rounded-md border bg-background px-3 py-2 text-xs shadow-sm"
            style={{ left: n.x, top: n.y }}
          >
            <strong>{n.type}</strong>
            <br />
            {n.label}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setNodes((prev) => [
              ...prev,
              { id: `n${Date.now()}`, type: "webhook", label: "https://", x: 120, y: 140 },
            ])
          }
        >
          + Webhook
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={async () => {
            setMessage(null);
            const res = await importAutomationRuleFromJson(exportJson());
            setMessage("error" in res ? res.error : "Regola importata da grafo.");
          }}
        >
          Importa come regola
        </Button>
      </div>
      <pre className="max-h-48 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">{exportJson()}</pre>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
