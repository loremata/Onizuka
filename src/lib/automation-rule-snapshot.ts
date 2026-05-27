import type { AutomationRule } from "@prisma/client";

export function automationRuleToSnapshot(rule: AutomationRule): Record<string, unknown> {
  return {
    name: rule.name,
    trigger: rule.trigger,
    priority: rule.priority,
    enabled: rule.enabled,
    notifyTelegram: rule.notifyTelegram,
    conditionKey: rule.conditionKey,
    conditionOperator: rule.conditionOperator,
    conditionValue: rule.conditionValue,
    notifyEmail: rule.notifyEmail,
    notifyEmailTo: rule.notifyEmailTo,
    emailSubjectTemplate: rule.emailSubjectTemplate,
    emailBodyTemplate: rule.emailBodyTemplate,
    webhookUrl: rule.webhookUrl,
    webhookPayloadTemplate: rule.webhookPayloadTemplate,
    actionRetryAttempts: rule.actionRetryAttempts,
    actionRetryBackoffSec: rule.actionRetryBackoffSec,
    createFlowTask: rule.createFlowTask,
    flowTaskTitle: rule.flowTaskTitle,
    ruleVersion: rule.ruleVersion,
  };
}
