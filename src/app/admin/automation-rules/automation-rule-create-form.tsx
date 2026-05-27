"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AutomationRuleTemplatePicker } from "./automation-rule-template-picker";
import { AutomationConditionBuilder } from "./automation-condition-builder";
import { createAutomationRule, type AutomationRuleResult } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "…" : "Aggiungi regola"}
    </Button>
  );
}

export function AutomationRuleCreateForm() {
  const [state, formAction] = useFormState(createAutomationRule, null as AutomationRuleResult);

  return (
    <form action={formAction} className="space-y-3">
      {state?.error ? (
        <div className="text-sm text-destructive">{state.error}</div>
      ) : null}
      <div id="auto-review" className="space-y-2">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" required placeholder="Es. Avvisa Telegram su approvazione" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="priority">Priorità (1 = prima)</Label>
        <Input id="priority" name="priority" type="number" min={1} max={9999} defaultValue={100} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="enabled" defaultChecked />
        Attiva
      </label>
      <div id="auto-trigger" className="space-y-2">
        <Label htmlFor="trigger">Trigger</Label>
        <select
          id="trigger"
          name="trigger"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          defaultValue="POST_APPROVED"
        >
          <option value="POST_APPROVED">POST_APPROVED — post approvato (autore = createdByUserId)</option>
          <option value="LEAD_CREATED">LEAD_CREATED — nuovo lead (proprietario CRM)</option>
          <option value="TICKET_CREATED">TICKET_CREATED — ticket portale (owner da opportunità/task/memorie sul cliente)</option>
          <option value="FINANCE_OVERDUE_SNAPSHOT">FINANCE_OVERDUE_SNAPSHOT — dopo cron sync, se hai voci OVERDUE</option>
          <option value="REACH_DRAFT_SENT">REACH_DRAFT_SENT — bozza Reach segnata come inviata (SMTP/Gmail o pulsante)</option>
          <option value="FINANCE_INCOME_CREATED">FINANCE_INCOME_CREATED — creazione voce entrata in Finance</option>
          <option value="WHATSAPP_INBOUND">WHATSAPP_INBOUND — messaggio WhatsApp in ingresso (webhook)</option>
        </select>
      </div>
      <div id="auto-condition" className="space-y-3">
        <AutomationConditionBuilder />
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="conditionKey">Condizione key (opzionale)</Label>
          <Input id="conditionKey" name="conditionKey" placeholder="Es. platform / clientId / trigger" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="conditionOperator">Operatore</Label>
          <select
            id="conditionOperator"
            name="conditionOperator"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue="EQ"
          >
            <option value="EQ">EQ (=)</option>
            <option value="NEQ">NEQ (!=)</option>
            <option value="GT">GT (&gt;)</option>
            <option value="GTE">GTE (&gt;=)</option>
            <option value="LT">LT (&lt;)</option>
            <option value="LTE">LTE (&lt;=)</option>
            <option value="CONTAINS">CONTAINS</option>
            <option value="STARTS_WITH">STARTS_WITH</option>
            <option value="ENDS_WITH">ENDS_WITH</option>
            <option value="IN">IN (csv)</option>
            <option value="DATE_BEFORE">DATE_BEFORE</option>
            <option value="DATE_AFTER">DATE_AFTER</option>
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="conditionValue">Condizione value</Label>
        <Input id="conditionValue" name="conditionValue" placeholder="Es. FACEBOOK / 100 / 2026-12-31T23:59:59Z" />
      </div>
      </div>
      <div id="auto-actions" className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="notifyTelegram" />
        Invia riepilogo a Telegram admin (TELEGRAM_ADMIN_CHAT_IDS)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="notifyEmail" />
        Invia email SMTP (best-effort)
      </label>
      <div className="space-y-2">
        <Label htmlFor="notifyEmailTo">Email destinatario (opzionale)</Label>
        <Input id="notifyEmailTo" name="notifyEmailTo" type="email" placeholder="ops@agency.com" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="actionRetryAttempts">Retry tentativi extra</Label>
          <Input id="actionRetryAttempts" name="actionRetryAttempts" type="number" min={0} max={5} defaultValue={0} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="actionRetryBackoffSec">Retry backoff sec base</Label>
          <Input id="actionRetryBackoffSec" name="actionRetryBackoffSec" type="number" min={1} max={60} defaultValue={2} />
        </div>
      </div>
      <AutomationRuleTemplatePicker />
      <div className="space-y-2">
        <Label htmlFor="emailSubjectTemplate">Template email subject (opzionale)</Label>
        <Input
          id="emailSubjectTemplate"
          name="emailSubjectTemplate"
          placeholder="[Onizuka] {{trigger}} · {{clientName}}"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="emailBodyTemplate">Template email body (opzionale)</Label>
        <textarea
          id="emailBodyTemplate"
          name="emailBodyTemplate"
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder={"Trigger: {{trigger}}\nLabel: {{label}}\nURL: {{url}}"}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="webhookUrl">Webhook (opzionale)</Label>
        <Input
          id="webhookUrl"
          name="webhookUrl"
          type="url"
          placeholder="https://… (POST JSON: trigger + payload)"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="webhookPayloadTemplate">Template payload webhook JSON (opzionale)</Label>
        <textarea
          id="webhookPayloadTemplate"
          name="webhookPayloadTemplate"
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          placeholder={'{"event":"{{trigger}}","subject":"{{subject}}","url":"{{url}}"}'}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="createFlowTask" />
        Crea task Flow sul cliente (solo trigger con cliente: post approvato, ticket; ignorato per snapshot finance)
      </label>
      <div className="space-y-2">
        <Label htmlFor="flowTaskTitle">Titolo task Flow (opzionale)</Label>
        <Input id="flowTaskTitle" name="flowTaskTitle" placeholder="Lascia vuoto per titolo automatico" />
      </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Le regole sono per utente: POST_APPROVED usa l&apos;autore del post; LEAD_CREATED l&apos;owner del lead;
        TICKET_CREATED i commerciali legati al cliente; FINANCE_OVERDUE_SNAPSHOT il proprietario delle voci finance;
        REACH_DRAFT_SENT l&apos;owner della bozza inviata; FINANCE_INCOME_CREATED il proprietario della voce finance.
        Placeholder template supportati in base al trigger: es. {"{{trigger}}"}, {"{{url}}"}, {"{{clientId}}"},
        {"{{subject}}"}, {"{{label}}"}, {"{{amountEur}}"}.
        Retry/backoff si applica a email/webhook (max 5 tentativi extra, backoff esponenziale).
      </p>
      <Submit />
    </form>
  );
}
