"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { AutomationRule } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AutomationRuleTemplatePicker } from "./automation-rule-template-picker";
import { updateAutomationRule, type AutomationRuleResult } from "./actions";
import { Select } from "@/components/ui/select";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "…" : "Salva modifica"}
    </Button>
  );
}

export function AutomationRuleEditForm({ rule }: { rule: AutomationRule }) {
  const [state, formAction] = useFormState(
    (_: AutomationRuleResult, fd: FormData) => updateAutomationRule(rule.id, _, fd),
    null as AutomationRuleResult
  );

  return (
    <form action={formAction} className="space-y-3">
      {state?.error ? <div className="text-sm text-destructive">{state.error}</div> : null}
      <div className="space-y-2">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" required defaultValue={rule.name} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="priority">Priorità</Label>
        <Input id="priority" name="priority" type="number" min={1} max={9999} defaultValue={rule.priority} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={rule.enabled} />
        Attiva
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="notifyTelegram" defaultChecked={rule.notifyTelegram} />
        Telegram admin
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="notifyEmail" defaultChecked={rule.notifyEmail} />
        Email SMTP
      </label>
      <div className="space-y-2">
        <Label htmlFor="notifyEmailTo">Email destinatario</Label>
        <Input id="notifyEmailTo" name="notifyEmailTo" type="email" defaultValue={rule.notifyEmailTo ?? ""} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="conditionKey">Condizione key</Label>
          <Input id="conditionKey" name="conditionKey" defaultValue={rule.conditionKey ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="conditionOperator">Operatore</Label>
          <Select
            id="conditionOperator"
            name="conditionOperator"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue={rule.conditionOperator}
          >
            {["EQ", "NEQ", "GT", "GTE", "LT", "LTE", "CONTAINS", "STARTS_WITH", "ENDS_WITH", "IN", "DATE_BEFORE", "DATE_AFTER"].map(
              (op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              )
            )}
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="conditionValue">Condizione value</Label>
        <Input id="conditionValue" name="conditionValue" defaultValue={rule.conditionValue ?? ""} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="actionRetryAttempts">Retry tentativi</Label>
          <Input id="actionRetryAttempts" name="actionRetryAttempts" type="number" min={0} max={5} defaultValue={rule.actionRetryAttempts} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="actionRetryBackoffSec">Backoff sec</Label>
          <Input id="actionRetryBackoffSec" name="actionRetryBackoffSec" type="number" min={1} max={60} defaultValue={rule.actionRetryBackoffSec} />
        </div>
      </div>
      <AutomationRuleTemplatePicker />
      <div className="space-y-2">
        <Label htmlFor="emailSubjectTemplate">Subject email</Label>
        <Input id="emailSubjectTemplate" name="emailSubjectTemplate" defaultValue={rule.emailSubjectTemplate ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="emailBodyTemplate">Body email</Label>
        <textarea
          id="emailBodyTemplate"
          name="emailBodyTemplate"
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          defaultValue={rule.emailBodyTemplate ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="webhookUrl">Webhook URL</Label>
        <Input id="webhookUrl" name="webhookUrl" type="url" defaultValue={rule.webhookUrl ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="webhookPayloadTemplate">Payload webhook JSON</Label>
        <textarea
          id="webhookPayloadTemplate"
          name="webhookPayloadTemplate"
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          defaultValue={rule.webhookPayloadTemplate ?? ""}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="createFlowTask" defaultChecked={rule.createFlowTask} />
        Crea task Flow
      </label>
      <div className="space-y-2">
        <Label htmlFor="flowTaskTitle">Titolo Flow</Label>
        <Input id="flowTaskTitle" name="flowTaskTitle" defaultValue={rule.flowTaskTitle ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="trigger">Trigger</Label>
        <Select
          id="trigger"
          name="trigger"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          defaultValue={rule.trigger}
        >
          <option value="POST_APPROVED">POST_APPROVED</option>
          <option value="LEAD_CREATED">LEAD_CREATED</option>
          <option value="TICKET_CREATED">TICKET_CREATED</option>
          <option value="FINANCE_OVERDUE_SNAPSHOT">FINANCE_OVERDUE_SNAPSHOT</option>
          <option value="REACH_DRAFT_SENT">REACH_DRAFT_SENT</option>
          <option value="FINANCE_INCOME_CREATED">FINANCE_INCOME_CREATED</option>
          <option value="WHATSAPP_INBOUND">WHATSAPP_INBOUND</option>
        </Select>
      </div>
      <Submit />
    </form>
  );
}
