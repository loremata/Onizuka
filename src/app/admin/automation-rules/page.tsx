import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { resolveAutomationKpiRange } from "@/lib/automation-kpi-date-range";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AutomationRuleCreateForm } from "./automation-rule-create-form";
import { AutomationRuleImportPanel } from "./automation-rule-import-panel";
import { AutomationRulePipelineBoard } from "./automation-rule-pipeline-board";
import { AutomationTemplateLibrary } from "./automation-template-library";
import { AutomationMarketplaceLibrary } from "./automation-marketplace-library";
import { AutomationRuleRowActions } from "./automation-rule-row-actions";
import { AutomationSandboxPanel } from "./automation-sandbox-panel";
import { AutomationQueuePanel } from "./automation-queue-panel";

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const AUTOMATION_RUN_STATUS_LABEL: Record<string, string> = {
  PENDING: "In coda",
  RUNNING: "In esecuzione",
  DONE: "Completata",
  FAILED: "Fallita",
};

export default async function AutomationRulesPage({ searchParams }: Props) {
  const session = await requireAdminArea();
  const { from, to, fromDay, toDay } = resolveAutomationKpiRange({
    from: firstParam(searchParams.from),
    to: firstParam(searchParams.to),
  });

  const runId = firstParam(searchParams.run);

  const [rules, executionLogs, recentAll, runDetail] = await Promise.all([
    prisma.automationRule.findMany({
      where: { ownerUserId: session.user.id },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    }),
    prisma.automationRuleExecution.findMany({
      where: { rule: { ownerUserId: session.user.id } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { rule: { select: { name: true } } },
    }),
    prisma.automationRuleExecution.findMany({
      where: { rule: { ownerUserId: session.user.id }, createdAt: { gte: from, lte: to } },
      select: { channel: true, success: true, attemptCount: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
    runId
      ? prisma.automationFlowRun.findFirst({
          where: { id: runId, ownerUserId: session.user.id },
          include: { rule: { select: { name: true } } },
        })
      : Promise.resolve(null),
  ]);

  const exportHref = `/api/admin/automation-rules/executions/export?from=${encodeURIComponent(fromDay)}&to=${encodeURIComponent(toDay)}`;

  const totalRecent = recentAll.length;
  const failedRecent = recentAll.filter((e) => !e.success).length;
  const failRate = totalRecent > 0 ? (failedRecent / totalRecent) * 100 : 0;
  const avgAttempts =
    totalRecent > 0 ? recentAll.reduce((acc, e) => acc + e.attemptCount, 0) / totalRecent : 0;
  const byChannel = new Map<string, { total: number; fail: number }>();
  for (const e of recentAll) {
    const row = byChannel.get(e.channel) ?? { total: 0, fail: 0 };
    row.total += 1;
    if (!e.success) row.fail += 1;
    byChannel.set(e.channel, row);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="onizuka-page-title">Regole automazione in-app</h1>
        <p className="text-muted-foreground">
          Trigger: <strong>POST_APPROVED</strong>, <strong>LEAD_CREATED</strong>, <strong>TICKET_CREATED</strong>,{" "}
          <strong>FINANCE_OVERDUE_SNAPSHOT</strong> (cron), <strong>REACH_DRAFT_SENT</strong>,{" "}
          <strong>FINANCE_INCOME_CREATED</strong>, <strong>WHATSAPP_INBOUND</strong>.{" "}
          <Link href="/admin/automation-rules/flow-builder" className="text-primary hover:underline">
            Flow builder visuale
          </Link>
          . Azioni: Telegram admin, email SMTP, webhook POST JSON,
          task Flow opzionale sul cliente. Supporto if/then esteso: priorità + operatori condizione + template +
          retry/backoff.
        </p>
      </div>

      {runId ? (
        <Card
          id="run-detail"
          className={runDetail?.status === "FAILED" ? "border-destructive/60" : "border-primary/60"}
        >
          <CardHeader>
            <CardTitle className="text-base">Dettaglio run coda</CardTitle>
            <CardDescription>
              Run <code className="text-xs">{runId}</code> dall&apos;inbox azioni.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {runDetail ? (
              <>
                <p>
                  <strong>{runDetail.rule.name}</strong> · stato:{" "}
                  <strong>{AUTOMATION_RUN_STATUS_LABEL[runDetail.status] ?? runDetail.status}</strong> · tentativi:{" "}
                  {runDetail.attemptCount}
                </p>
                <p className="text-xs text-muted-foreground">
                  Pianificata: {runDetail.scheduledAt.toLocaleString("it-IT")}
                  {runDetail.startedAt ? ` · Avviata: ${runDetail.startedAt.toLocaleString("it-IT")}` : ""}
                  {runDetail.completedAt ? ` · Conclusa: ${runDetail.completedAt.toLocaleString("it-IT")}` : ""}
                </p>
                {runDetail.errorDetail ? (
                  <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
                    {runDetail.errorDetail}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">Run non trovata (eliminata o di un altro utente).</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <AutomationSandboxPanel rules={rules.map((r) => ({ id: r.id, name: r.name }))} />
      <AutomationQueuePanel rules={rules.map((r) => ({ id: r.id, name: r.name }))} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nuova regola</CardTitle>
            <CardDescription>Una riga per utente; combina con webhook per copertura completa.</CardDescription>
          </CardHeader>
          <CardContent>
            <AutomationRulePipelineBoard />
            <AutomationRuleCreateForm />
            <AutomationRuleImportPanel />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Regole attive</CardTitle>
          </CardHeader>
          <CardContent>
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna regola. Aggiungi dalla colonna sinistra.</p>
            ) : (
              <ul className="divide-y text-sm">
                {rules.map((r) => (
                  <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        prio {r.priority} · v{r.ruleVersion} · {r.trigger} · {r.enabled ? "on" : "off"} · TG:{" "}
                        {r.notifyTelegram ? "sì" : "no"} · webhook: {r.webhookUrl ? "sì" : "no"} · Email:{" "}
                        {r.notifyEmail ? "sì" : "no"} · Flow: {r.createFlowTask ? "sì" : "no"}
                        {r.conditionKey && r.conditionValue
                          ? ` · if ${r.conditionKey} ${r.conditionOperator} ${r.conditionValue}`
                          : ""}
                        {r.actionRetryAttempts > 0
                          ? ` · retry ${r.actionRetryAttempts} (base ${r.actionRetryBackoffSec}s)`
                          : ""}
                      </p>
                    </div>
                    <AutomationRuleRowActions
                      id={r.id}
                      name={r.name}
                      enabled={r.enabled}
                      trigger={r.trigger}
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <AutomationTemplateLibrary />
      <AutomationMarketplaceLibrary />

      <Card>
        <CardHeader>
          <CardTitle>KPI regole</CardTitle>
          <CardDescription>
            Finestra temporale (UTC): <strong>{fromDay}</strong> → <strong>{toDay}</strong> (max 90 giorni). Fail-rate
            e carico per canale.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <form className="flex flex-wrap items-end gap-3 border-b border-border pb-3" method="get" action="/admin/automation-rules">
            <div className="space-y-1">
              <label htmlFor="kpi-from" className="text-xs text-muted-foreground">
                Da
              </label>
              <Input id="kpi-from" name="from" type="date" defaultValue={fromDay} className="h-9 w-[150px] text-sm" />
            </div>
            <div className="space-y-1">
              <label htmlFor="kpi-to" className="text-xs text-muted-foreground">
                A
              </label>
              <Input id="kpi-to" name="to" type="date" defaultValue={toDay} className="h-9 w-[150px] text-sm" />
            </div>
            <Button type="submit" variant="secondary" size="sm" className="h-9">
              Aggiorna KPI
            </Button>
            <Button asChild variant="outline" size="sm" className="h-9">
              <a href={exportHref}>Esporta CSV esecuzioni</a>
            </Button>
          </form>
          <p>
            Eventi totali: <strong>{totalRecent}</strong> · Fail: <strong>{failedRecent}</strong> · Fail-rate:{" "}
            <strong>{failRate.toFixed(1)}%</strong> · Tentativi medi: <strong>{avgAttempts.toFixed(2)}</strong>
          </p>
          {byChannel.size > 0 ? (
            <ul className="divide-y">
              {Array.from(byChannel.entries()).map(([channel, row]) => (
                <li key={channel} className="py-1">
                  <strong>{channel}</strong> · {row.total} eventi · fail {row.fail} (
                  {((row.fail / Math.max(1, row.total)) * 100).toFixed(1)}%)
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Nessun evento nell&apos;intervallo.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit esecuzioni regole</CardTitle>
          <CardDescription>Ultimi 30 eventi (Telegram/email/webhook/flow/condizione/simulazione).</CardDescription>
        </CardHeader>
        <CardContent>
          {executionLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna esecuzione registrata.</p>
          ) : (
            <ul className="divide-y text-sm">
              {executionLogs.map((e) => (
                <li key={e.id} className="py-2">
                  <p className="font-medium">
                    {e.rule.name} · {e.channel} · {e.success ? "ok" : "fail"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    tentativi: {e.attemptCount}
                    {e.errorDetail ? ` · ${e.errorDetail}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Button asChild variant="outline" size="sm">
        <Link href="/admin/automations">← Control Center automazioni</Link>
      </Button>
    </div>
  );
}
