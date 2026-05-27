"use server";

import type { AutomationRuleTrigger } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdminArea } from "@/lib/admin-session";
import { defaultSimulationVarsForTrigger } from "@/lib/automation-simulation-presets";
import { parseAutomationRuleFormData } from "@/lib/automation-rule-form-parse";
import { automationRuleToSnapshot } from "@/lib/automation-rule-snapshot";
import { prisma } from "@/lib/prisma";

export type AutomationRuleResult = { error: string } | null;
export type AutomationRuleSimulationResult =
  | { ok: true; matched: boolean; note: string; rendered?: { subject: string | null; body: string | null; webhook: string | null } }
  | { error: string };

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k: string) => vars[k] ?? "");
}

function matchesCondition(
  conditionKey: string | null,
  conditionOperator: string | null,
  conditionValue: string | null,
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
  const aDate = Date.parse(a);
  const eDate = Date.parse(expected);
  const hasDate = Number.isFinite(aDate) && Number.isFinite(eDate);

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
    case "STARTS_WITH":
      return aLower.startsWith(eLower);
    case "ENDS_WITH":
      return aLower.endsWith(eLower);
    case "IN":
      return expected
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .includes(aLower);
    case "DATE_BEFORE":
      return hasDate ? aDate < eDate : false;
    case "DATE_AFTER":
      return hasDate ? aDate > eDate : false;
    case "EQ":
    default:
      return aLower === eLower;
  }
}

export async function createAutomationRule(
  _prev: AutomationRuleResult,
  formData: FormData
): Promise<AutomationRuleResult> {
  const session = await requireAdminArea();
  const parsed = parseAutomationRuleFormData(formData);
  if ("error" in parsed) return { error: parsed.error };

  await prisma.automationRule.create({
    data: {
      ownerUserId: session.user.id,
      ...parsed,
    },
  });

  revalidatePath("/admin/automation-rules");
  return null;
}

export async function updateAutomationRule(
  id: string,
  _prev: AutomationRuleResult,
  formData: FormData
): Promise<AutomationRuleResult> {
  const session = await requireAdminArea();
  const row = await prisma.automationRule.findFirst({
    where: { id, ownerUserId: session.user.id },
  });
  if (!row) return { error: "Regola non trovata." };

  const parsed = parseAutomationRuleFormData(formData);
  if ("error" in parsed) return { error: parsed.error };

  const nextVersion = row.ruleVersion + 1;
  await prisma.$transaction([
    prisma.automationRuleRevision.create({
      data: {
        ruleId: row.id,
        version: row.ruleVersion,
        snapshotJson: JSON.stringify(automationRuleToSnapshot(row)),
        createdByUserId: session.user.id,
      },
    }),
    prisma.automationRule.update({
      where: { id },
      data: { ...parsed, ruleVersion: nextVersion },
    }),
  ]);

  revalidatePath("/admin/automation-rules");
  revalidatePath(`/admin/automation-rules/${id}/edit`);
  return null;
}

export async function toggleAutomationRule(id: string, enabled: boolean): Promise<AutomationRuleResult> {
  const session = await requireAdminArea();
  const row = await prisma.automationRule.findFirst({
    where: { id, ownerUserId: session.user.id },
  });
  if (!row) return { error: "Regola non trovata." };
  await prisma.automationRule.update({ where: { id }, data: { enabled } });
  revalidatePath("/admin/automation-rules");
  return null;
}

export async function deleteAutomationRule(id: string): Promise<AutomationRuleResult> {
  const session = await requireAdminArea();
  const row = await prisma.automationRule.findFirst({
    where: { id, ownerUserId: session.user.id },
  });
  if (!row) return { error: "Regola non trovata." };
  await prisma.automationRule.delete({ where: { id } });
  revalidatePath("/admin/automation-rules");
  return null;
}

export async function duplicateAutomationRule(id: string): Promise<AutomationRuleResult> {
  const session = await requireAdminArea();
  const row = await prisma.automationRule.findFirst({
    where: { id, ownerUserId: session.user.id },
  });
  if (!row) return { error: "Regola non trovata." };

  const name = `${row.name} (copia)`.slice(0, 200);
  await prisma.automationRule.create({
    data: {
      ownerUserId: session.user.id,
      name,
      trigger: row.trigger,
      priority: Math.min(9999, row.priority + 1),
      enabled: false,
      notifyTelegram: row.notifyTelegram,
      conditionKey: row.conditionKey,
      conditionOperator: row.conditionOperator,
      conditionValue: row.conditionValue,
      notifyEmail: row.notifyEmail,
      notifyEmailTo: row.notifyEmailTo,
      emailSubjectTemplate: row.emailSubjectTemplate,
      emailBodyTemplate: row.emailBodyTemplate,
      webhookUrl: row.webhookUrl,
      webhookPayloadTemplate: row.webhookPayloadTemplate,
      actionRetryAttempts: row.actionRetryAttempts,
      actionRetryBackoffSec: row.actionRetryBackoffSec,
      createFlowTask: row.createFlowTask,
      flowTaskTitle: row.flowTaskTitle,
    },
  });

  revalidatePath("/admin/automation-rules");
  return null;
}

export async function simulateAutomationRule(
  id: string,
  payloadJson?: string
): Promise<AutomationRuleSimulationResult> {
  const session = await requireAdminArea();
  const rule = await prisma.automationRule.findFirst({
    where: { id, ownerUserId: session.user.id },
    select: {
      id: true,
      trigger: true,
      conditionKey: true,
      conditionOperator: true,
      conditionValue: true,
      emailSubjectTemplate: true,
      emailBodyTemplate: true,
      webhookPayloadTemplate: true,
    },
  });
  if (!rule) return { error: "Regola non trovata." };

  const fakeVars: Record<string, string> = {
    ...defaultSimulationVarsForTrigger(rule.trigger),
    trigger: rule.trigger,
    createdAt: new Date().toISOString(),
  };
  if (payloadJson?.trim()) {
    try {
      const parsed = JSON.parse(payloadJson) as Record<string, unknown>;
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          fakeVars[k] = String(v);
        }
      }
    } catch {
      return { error: "Payload JSON simulazione non valido." };
    }
  }

  const op = (rule.conditionOperator || "EQ").trim().toUpperCase();
  const expected = rule.conditionValue?.trim() || "";
  const matched = matchesCondition(rule.conditionKey, rule.conditionOperator, rule.conditionValue, fakeVars);

  const renderedSubject = rule.emailSubjectTemplate
    ? rule.emailSubjectTemplate.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k: string) => fakeVars[k] ?? "")
    : null;
  const renderedBody = rule.emailBodyTemplate
    ? rule.emailBodyTemplate.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k: string) => fakeVars[k] ?? "")
    : null;
  const renderedWebhook = rule.webhookPayloadTemplate
    ? rule.webhookPayloadTemplate.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k: string) => fakeVars[k] ?? "")
    : null;

  await prisma.automationRuleExecution.create({
    data: {
      ruleId: rule.id,
      channel: "SIMULATION",
      success: matched,
      attemptCount: 1,
      errorDetail: matched ? null : `Condizione non soddisfatta (${rule.conditionKey} ${op} ${expected})`,
      payloadJson: JSON.stringify({
        vars: fakeVars,
        renderedSubject,
        renderedBody,
        renderedWebhook,
      }).slice(0, 10000),
    },
  });
  revalidatePath("/admin/automation-rules");

  return {
    ok: true,
    matched,
    note: matched ? "Simulazione OK: condizione soddisfatta." : "Simulazione completata: condizione non soddisfatta.",
    rendered: {
      subject: renderedSubject,
      body: renderedBody,
      webhook: renderedWebhook,
    },
  };
}

type ImportResult = { error: string } | { ok: true; id: string };

export async function importAutomationRuleFromJson(jsonText: string): Promise<ImportResult> {
  const session = await requireAdminArea();
  let parsed: { rule?: Record<string, unknown> };
  try {
    parsed = JSON.parse(jsonText.trim()) as { rule?: Record<string, unknown> };
  } catch {
    return { error: "JSON non valido." };
  }
  const r = parsed.rule ?? (parsed as Record<string, unknown>);
  const name = typeof r.name === "string" ? r.name.trim().slice(0, 200) : "";
  if (!name) return { error: "Campo rule.name obbligatorio." };

  const trigger =
    typeof r.trigger === "string" && r.trigger.length > 0
      ? (r.trigger as import("@prisma/client").AutomationRuleTrigger)
      : "POST_APPROVED";

  const created = await prisma.automationRule.create({
    data: {
      ownerUserId: session.user.id,
      name: `${name} (import)`.slice(0, 200),
      trigger,
      priority: typeof r.priority === "number" ? Math.min(9999, Math.max(1, r.priority)) : 100,
      enabled: false,
      notifyTelegram: r.notifyTelegram === true,
      notifyEmail: r.notifyEmail === true,
      notifyEmailTo: typeof r.notifyEmailTo === "string" ? r.notifyEmailTo.slice(0, 320) : null,
      conditionKey: typeof r.conditionKey === "string" ? r.conditionKey.slice(0, 80) : null,
      conditionOperator: typeof r.conditionOperator === "string" ? r.conditionOperator.slice(0, 32) : "EQ",
      conditionValue: typeof r.conditionValue === "string" ? r.conditionValue.slice(0, 200) : null,
      emailSubjectTemplate: typeof r.emailSubjectTemplate === "string" ? r.emailSubjectTemplate : null,
      emailBodyTemplate: typeof r.emailBodyTemplate === "string" ? r.emailBodyTemplate : null,
      webhookUrl: typeof r.webhookUrl === "string" ? r.webhookUrl : null,
      webhookPayloadTemplate: typeof r.webhookPayloadTemplate === "string" ? r.webhookPayloadTemplate : null,
      actionRetryAttempts: typeof r.actionRetryAttempts === "number" ? Math.min(5, Math.max(0, r.actionRetryAttempts)) : 0,
      actionRetryBackoffSec: typeof r.actionRetryBackoffSec === "number" ? Math.min(60, Math.max(1, r.actionRetryBackoffSec)) : 2,
      createFlowTask: r.createFlowTask === true,
      flowTaskTitle: typeof r.flowTaskTitle === "string" ? r.flowTaskTitle : null,
      flowBranchesJson:
        typeof r.flowBranchesJson === "string"
          ? r.flowBranchesJson.slice(0, 20000)
          : null,
      visualFlowJson:
        typeof r.visualFlowJson === "string" ? r.visualFlowJson.slice(0, 50000) : null,
    },
  });

  revalidatePath("/admin/automation-rules");
  return { ok: true, id: created.id };
}

export async function restoreAutomationRuleRevision(
  ruleId: string,
  version: number
): Promise<AutomationRuleResult> {
  const session = await requireAdminArea();
  const rule = await prisma.automationRule.findFirst({
    where: { id: ruleId, ownerUserId: session.user.id },
  });
  if (!rule) return { error: "Regola non trovata." };

  const rev = await prisma.automationRuleRevision.findFirst({
    where: { ruleId, version },
  });
  if (!rev) return { error: "Revisione non trovata." };

  let snap: Record<string, unknown>;
  try {
    snap = JSON.parse(rev.snapshotJson) as Record<string, unknown>;
  } catch {
    return { error: "Snapshot revisione corrotto." };
  }

  await prisma.$transaction([
    prisma.automationRuleRevision.create({
      data: {
        ruleId,
        version: rule.ruleVersion,
        snapshotJson: JSON.stringify(automationRuleToSnapshot(rule)),
        createdByUserId: session.user.id,
      },
    }),
    prisma.automationRule.update({
      where: { id: ruleId },
      data: {
        name: String(snap.name ?? rule.name).slice(0, 200),
        trigger: (snap.trigger as import("@prisma/client").AutomationRuleTrigger) ?? rule.trigger,
        priority: typeof snap.priority === "number" ? snap.priority : rule.priority,
        notifyTelegram: snap.notifyTelegram === true,
        notifyEmail: snap.notifyEmail === true,
        notifyEmailTo: typeof snap.notifyEmailTo === "string" ? snap.notifyEmailTo : null,
        conditionKey: typeof snap.conditionKey === "string" ? snap.conditionKey : null,
        conditionOperator: typeof snap.conditionOperator === "string" ? String(snap.conditionOperator) : "EQ",
        conditionValue: typeof snap.conditionValue === "string" ? snap.conditionValue : null,
        emailSubjectTemplate: typeof snap.emailSubjectTemplate === "string" ? snap.emailSubjectTemplate : null,
        emailBodyTemplate: typeof snap.emailBodyTemplate === "string" ? snap.emailBodyTemplate : null,
        webhookUrl: typeof snap.webhookUrl === "string" ? snap.webhookUrl : null,
        webhookPayloadTemplate: typeof snap.webhookPayloadTemplate === "string" ? snap.webhookPayloadTemplate : null,
        actionRetryAttempts: typeof snap.actionRetryAttempts === "number" ? snap.actionRetryAttempts : 0,
        actionRetryBackoffSec: typeof snap.actionRetryBackoffSec === "number" ? snap.actionRetryBackoffSec : 2,
        createFlowTask: snap.createFlowTask === true,
        flowTaskTitle: typeof snap.flowTaskTitle === "string" ? snap.flowTaskTitle : null,
        ruleVersion: rule.ruleVersion + 1,
      },
    }),
  ]);

  revalidatePath("/admin/automation-rules");
  revalidatePath(`/admin/automation-rules/${ruleId}/edit`);
  return null;
}

export async function saveAutomationFlowVersion(
  ruleId: string,
  visualFlowJson: string
): Promise<AutomationRuleResult> {
  const session = await requireAdminArea();
  const rule = await prisma.automationRule.findFirst({
    where: { id: ruleId, ownerUserId: session.user.id },
  });
  if (!rule) return { error: "Regola non trovata." };

  await prisma.$transaction([
    prisma.automationRuleRevision.create({
      data: {
        ruleId,
        version: rule.ruleVersion,
        snapshotJson: JSON.stringify(automationRuleToSnapshot(rule)),
        createdByUserId: session.user.id,
      },
    }),
    prisma.automationRule.update({
      where: { id: ruleId },
      data: {
        visualFlowJson: visualFlowJson.slice(0, 50000),
        ruleVersion: rule.ruleVersion + 1,
      },
    }),
  ]);

  revalidatePath("/admin/automation-rules");
  revalidatePath(`/admin/automation-rules/${ruleId}/edit`);
  return null;
}
