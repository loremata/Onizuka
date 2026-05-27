import type { AutomationRuleTrigger } from "@prisma/client";
import { flowGraphToBranchesJson } from "@/lib/automation-branches";

export type FlowNodeType = "trigger" | "condition" | "telegram" | "email" | "webhook" | "flow_task";

export type FlowNode = {
  id: string;
  type: FlowNodeType;
  label: string;
  x: number;
  y: number;
};

export type FlowEdge = { from: string; to: string };

export type AutomationFlowGraph = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  meta?: { name?: string; trigger?: AutomationRuleTrigger };
};

export function parseFlowGraphJson(raw: string): AutomationFlowGraph | null {
  try {
    const g = JSON.parse(raw) as AutomationFlowGraph;
    if (!Array.isArray(g.nodes) || !Array.isArray(g.edges)) return null;
    return g;
  } catch {
    return null;
  }
}

/** Converte un grafo visuale in snapshot importabile (regola disattivata). */
export function flowGraphToRuleSnapshot(graph: AutomationFlowGraph) {
  const triggerNode = graph.nodes.find((n) => n.type === "trigger");
  const trigger = (graph.meta?.trigger ?? "LEAD_CREATED") as AutomationRuleTrigger;
  const hasTelegram = graph.nodes.some((n) => n.type === "telegram");
  const hasEmail = graph.nodes.some((n) => n.type === "email");
  const webhookNode = graph.nodes.find((n) => n.type === "webhook");
  const condNode = graph.nodes.find((n) => n.type === "condition");
  const flowNode = graph.nodes.find((n) => n.type === "flow_task");

  return {
    name: graph.meta?.name ?? `Flusso ${trigger}`,
    trigger,
    enabled: false,
    priority: 100,
    notifyTelegram: hasTelegram,
    notifyEmail: hasEmail,
    conditionKey: condNode ? "trigger" : null,
    conditionOperator: "EQ",
    conditionValue: condNode ? trigger : null,
    webhookUrl: webhookNode?.label.startsWith("http") ? webhookNode.label : null,
    createFlowTask: !!flowNode,
    flowTaskTitle: flowNode?.label ?? null,
    visualFlowJson: JSON.stringify(graph),
    flowBranchesJson: flowGraphToBranchesJson(graph.nodes),
  };
}
