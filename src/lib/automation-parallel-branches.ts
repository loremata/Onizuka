import type { AutomationRuleActionRow } from "@/lib/automation-rules-run";
import { parseFlowBranchesJson } from "@/lib/automation-branches";

type TemplateVars = Record<string, string | number | boolean | null | undefined>;

function branchMatches(
  branch: ReturnType<typeof parseFlowBranchesJson>[number],
  vars: Record<string, string>
): boolean {
  const key = branch.conditionKey?.trim();
  if (!key) return true;
  const actual = vars[key];
  if (actual == null) return false;
  const op = (branch.conditionOperator || "EQ").trim().toUpperCase();
  const expected = (branch.conditionValue ?? "").trim();
  const a = actual.trim().toLowerCase();
  const e = expected.toLowerCase();
  if (op === "CONTAINS") return a.includes(e);
  if (op === "NEQ") return a !== e;
  return a === e;
}

/** Regole con branch multipli: tiene la regola se almeno un branch matcha. */
export function filterRulesWithParallelBranches(
  rules: AutomationRuleActionRow[],
  vars: TemplateVars,
  flowBranchesJsonByRuleId: Map<string, string | null>
): AutomationRuleActionRow[] {
  const stringVars: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    if (v != null) stringVars[k] = String(v);
  }

  return rules.filter((rule) => {
    const raw = flowBranchesJsonByRuleId.get(rule.id);
    const branches = parseFlowBranchesJson(raw ?? null);
    if (branches.length === 0) return true;
    return branches.some((b) => branchMatches(b, stringVars));
  });
}

/** Esegue handler per ogni regola eligible in parallelo (email/webhook per regola). */
export async function runRuleActionsInParallel(
  tasks: (() => Promise<void>)[]
): Promise<{ fulfilled: number; rejected: number }> {
  const results = await Promise.allSettled(tasks.map((t) => t()));
  return {
    fulfilled: results.filter((r) => r.status === "fulfilled").length,
    rejected: results.filter((r) => r.status === "rejected").length,
  };
}
