export type AutomationFlowBranch = {
  id: string;
  label?: string;
  conditionKey?: string | null;
  conditionOperator?: string | null;
  conditionValue?: string | null;
  actions?: ("telegram" | "email" | "webhook" | "flow_task")[];
};

export function parseFlowBranchesJson(raw: string | null | undefined): AutomationFlowBranch[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as AutomationFlowBranch[];
    if (parsed && typeof parsed === "object" && "branches" in parsed) {
      const b = (parsed as { branches?: unknown }).branches;
      return Array.isArray(b) ? (b as AutomationFlowBranch[]) : [];
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function flowGraphToBranchesJson(nodes: { id: string; type: string; label: string }[]): string {
  const conditionNodes = nodes.filter((n) => n.type === "condition");
  const actionNodes = nodes.filter((n) => n.type !== "trigger" && n.type !== "condition");
  const branches: AutomationFlowBranch[] = conditionNodes.map((c, i) => ({
    id: c.id,
    label: c.label,
    conditionKey: c.label.includes(":") ? c.label.split(":")[0]?.trim() : null,
    actions: actionNodes.slice(i, i + 2).map((a) => {
      if (a.type === "telegram") return "telegram" as const;
      if (a.type === "email") return "email" as const;
      if (a.type === "webhook") return "webhook" as const;
      return "flow_task" as const;
    }),
  }));
  return JSON.stringify({ branches }, null, 2);
}
