import type { AutomationRuleTrigger } from "@prisma/client";
import { parseFlowBranchesJson, type AutomationFlowBranch } from "@/lib/automation-branches";

export type AutomationSandboxResult = {
  matched: boolean;
  note: string;
  branches: { id: string; label?: string; matched: boolean }[];
  rendered: {
    subject: string | null;
    body: string | null;
    webhook: string | null;
  };
  dryRun: true;
};

function matchesCondition(
  conditionKey: string | null | undefined,
  conditionOperator: string | null | undefined,
  conditionValue: string | null | undefined,
  vars: Record<string, string>
): boolean {
  const key = conditionKey?.trim();
  if (!key) return true;
  const actual = vars[key];
  if (actual == null) return false;

  const op = (conditionOperator || "EQ").trim().toUpperCase();
  const expected = (conditionValue ?? "").trim();
  const a = actual.trim();
  const aLower = a.toLowerCase();
  const eLower = expected.toLowerCase();

  const aNum = Number(a.replace(",", "."));
  const eNum = Number(expected.replace(",", "."));
  const hasNum = Number.isFinite(aNum) && Number.isFinite(eNum);

  switch (op) {
    case "NEQ":
      return aLower !== eLower;
    case "GT":
      return hasNum ? aNum > eNum : false;
    case "GTE":
      return hasNum ? aNum >= eNum : false;
    case "LT":
      return hasNum ? aNum < eNum : false;
    case "LTE":
      return hasNum ? aNum <= eNum : false;
    case "CONTAINS":
      return aLower.includes(eLower);
    case "EQ":
    default:
      return aLower === eLower;
  }
}

function renderTemplate(template: string | null, vars: Record<string, string>): string | null {
  if (!template) return null;
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k: string) => vars[k] ?? "");
}

function evaluateBranches(
  branches: AutomationFlowBranch[],
  vars: Record<string, string>
): { id: string; label?: string; matched: boolean }[] {
  return branches.map((b) => ({
    id: b.id,
    label: b.label,
    matched: matchesCondition(b.conditionKey, b.conditionOperator, b.conditionValue, vars),
  }));
}

/** Simulazione senza side-effect (no SMTP, webhook, Telegram, DB execution). */
export function runAutomationSandbox(params: {
  trigger: AutomationRuleTrigger;
  conditionKey: string | null;
  conditionOperator: string | null;
  conditionValue: string | null;
  emailSubjectTemplate: string | null;
  emailBodyTemplate: string | null;
  webhookPayloadTemplate: string | null;
  flowBranchesJson: string | null;
  defaultVars: Record<string, string>;
  payloadJson?: string;
}): AutomationSandboxResult | { error: string } {
  const fakeVars: Record<string, string> = {
    ...params.defaultVars,
    trigger: params.trigger,
    createdAt: new Date().toISOString(),
  };

  if (params.payloadJson?.trim()) {
    try {
      const parsed = JSON.parse(params.payloadJson) as Record<string, unknown>;
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          fakeVars[k] = String(v);
        }
      }
    } catch {
      return { error: "Payload JSON simulazione non valido." };
    }
  }

  const branches = parseFlowBranchesJson(params.flowBranchesJson);
  const branchResults = evaluateBranches(branches, fakeVars);
  const rootMatched = matchesCondition(
    params.conditionKey,
    params.conditionOperator,
    params.conditionValue,
    fakeVars
  );
  const anyBranchMatched = branchResults.some((b) => b.matched);
  const matched = branches.length > 0 ? anyBranchMatched && rootMatched : rootMatched;

  return {
    matched,
    note: matched
      ? "Sandbox: condizione soddisfatta (nessuna azione inviata)."
      : "Sandbox: condizione non soddisfatta (dry-run).",
    branches: branchResults,
    rendered: {
      subject: renderTemplate(params.emailSubjectTemplate, fakeVars),
      body: renderTemplate(params.emailBodyTemplate, fakeVars),
      webhook: renderTemplate(params.webhookPayloadTemplate, fakeVars),
    },
    dryRun: true,
  };
}
