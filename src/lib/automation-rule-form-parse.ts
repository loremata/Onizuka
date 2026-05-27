import type { AutomationRuleTrigger } from "@prisma/client";

export type ParsedAutomationRuleForm = {
  name: string;
  trigger: AutomationRuleTrigger;
  webhookUrl: string | null;
  priority: number;
  conditionOperator: string;
  conditionKey: string | null;
  conditionValue: string | null;
  notifyEmailTo: string | null;
  emailSubjectTemplate: string | null;
  emailBodyTemplate: string | null;
  webhookPayloadTemplate: string | null;
  actionRetryAttempts: number;
  actionRetryBackoffSec: number;
  flowTaskTitle: string | null;
  enabled: boolean;
  notifyTelegram: boolean;
  notifyEmail: boolean;
  createFlowTask: boolean;
};

function parseTrigger(raw: FormDataEntryValue | null): AutomationRuleTrigger {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s === "LEAD_CREATED") return "LEAD_CREATED";
  if (s === "TICKET_CREATED") return "TICKET_CREATED";
  if (s === "FINANCE_OVERDUE_SNAPSHOT") return "FINANCE_OVERDUE_SNAPSHOT";
  if (s === "REACH_DRAFT_SENT") return "REACH_DRAFT_SENT";
  if (s === "FINANCE_INCOME_CREATED") return "FINANCE_INCOME_CREATED";
  if (s === "WHATSAPP_INBOUND") return "WHATSAPP_INBOUND";
  return "POST_APPROVED";
}

export function parseAutomationRuleFormData(formData: FormData): ParsedAutomationRuleForm | { error: string } {
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Nome regola obbligatorio." };

  const trigger = parseTrigger(formData.get("trigger"));
  const webhookRaw = (formData.get("webhookUrl") as string)?.trim();
  const webhookUrl = webhookRaw && webhookRaw.length > 0 ? webhookRaw.slice(0, 2000) : null;
  const priorityRaw = Number(formData.get("priority"));
  const priority = Number.isFinite(priorityRaw) ? Math.max(1, Math.min(9999, Math.round(priorityRaw))) : 100;
  const conditionOperatorRaw = (formData.get("conditionOperator") as string)?.trim().toUpperCase();
  const allowedOperators = new Set([
    "EQ",
    "NEQ",
    "GT",
    "GTE",
    "LT",
    "LTE",
    "CONTAINS",
    "STARTS_WITH",
    "ENDS_WITH",
    "IN",
    "DATE_BEFORE",
    "DATE_AFTER",
  ]);
  const conditionOperator =
    conditionOperatorRaw && allowedOperators.has(conditionOperatorRaw) ? conditionOperatorRaw : "EQ";
  const conditionKeyRaw = (formData.get("conditionKey") as string)?.trim();
  const conditionValueRaw = (formData.get("conditionValue") as string)?.trim();
  const conditionKey = conditionKeyRaw && conditionKeyRaw.length > 0 ? conditionKeyRaw.slice(0, 80) : null;
  const conditionValue = conditionValueRaw && conditionValueRaw.length > 0 ? conditionValueRaw.slice(0, 200) : null;
  const notifyEmailToRaw = (formData.get("notifyEmailTo") as string)?.trim();
  const notifyEmailTo = notifyEmailToRaw && notifyEmailToRaw.length > 0 ? notifyEmailToRaw.slice(0, 320) : null;
  const emailSubjectTemplateRaw = (formData.get("emailSubjectTemplate") as string)?.trim();
  const emailBodyTemplateRaw = (formData.get("emailBodyTemplate") as string)?.trim();
  const webhookPayloadTemplateRaw = (formData.get("webhookPayloadTemplate") as string)?.trim();
  const emailSubjectTemplate =
    emailSubjectTemplateRaw && emailSubjectTemplateRaw.length > 0 ? emailSubjectTemplateRaw.slice(0, 2000) : null;
  const emailBodyTemplate =
    emailBodyTemplateRaw && emailBodyTemplateRaw.length > 0 ? emailBodyTemplateRaw.slice(0, 6000) : null;
  const webhookPayloadTemplate =
    webhookPayloadTemplateRaw && webhookPayloadTemplateRaw.length > 0 ? webhookPayloadTemplateRaw.slice(0, 6000) : null;
  const actionRetryAttemptsRaw = Number(formData.get("actionRetryAttempts"));
  const actionRetryBackoffSecRaw = Number(formData.get("actionRetryBackoffSec"));
  const actionRetryAttempts = Number.isFinite(actionRetryAttemptsRaw)
    ? Math.max(0, Math.min(5, Math.round(actionRetryAttemptsRaw)))
    : 0;
  const actionRetryBackoffSec = Number.isFinite(actionRetryBackoffSecRaw)
    ? Math.max(1, Math.min(60, Math.round(actionRetryBackoffSecRaw)))
    : 2;
  const flowTitleRaw = (formData.get("flowTaskTitle") as string)?.trim();
  const flowTaskTitle = flowTitleRaw && flowTitleRaw.length > 0 ? flowTitleRaw.slice(0, 500) : null;

  return {
    name,
    trigger,
    webhookUrl,
    priority,
    conditionOperator,
    conditionKey,
    conditionValue,
    notifyEmailTo,
    emailSubjectTemplate,
    emailBodyTemplate,
    webhookPayloadTemplate,
    actionRetryAttempts,
    actionRetryBackoffSec,
    flowTaskTitle,
    enabled: formData.get("enabled") === "on",
    notifyTelegram: formData.get("notifyTelegram") === "on",
    notifyEmail: formData.get("notifyEmail") === "on",
    createFlowTask: formData.get("createFlowTask") === "on",
  };
}
