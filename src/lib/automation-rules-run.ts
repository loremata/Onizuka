import type { AutomationRuleTrigger } from "@prisma/client";
import { filterRulesWithParallelBranches, runRuleActionsInParallel } from "@/lib/automation-parallel-branches";
import { prisma } from "@/lib/prisma";
import { sendEmailViaSmtp } from "@/lib/smtp-send";
import { notifyAdminsViaTelegram } from "@/lib/telegram-bot";

export type AutomationRuleActionRow = {
  id: string;
  ownerUserId: string;
  flowBranchesJson?: string | null;
  priority: number;
  conditionKey: string | null;
  conditionOperator: string;
  conditionValue: string | null;
  notifyTelegram: boolean;
  notifyEmail: boolean;
  notifyEmailTo: string | null;
  emailSubjectTemplate: string | null;
  emailBodyTemplate: string | null;
  webhookUrl: string | null;
  webhookPayloadTemplate: string | null;
  actionRetryAttempts: number;
  actionRetryBackoffSec: number;
  createFlowTask: boolean;
  flowTaskTitle: string | null;
};

function publicBaseUrl(): string {
  return (
    process.env.ONIZUKA_PRIMARY_HOST?.replace(/\/$/, "") ??
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    ""
  );
}

export async function loadRules(ownerUserId: string, trigger: AutomationRuleTrigger): Promise<AutomationRuleActionRow[]> {
  return prisma.automationRule.findMany({
    where: { ownerUserId, enabled: true, trigger },
    select: {
      ownerUserId: true,
      id: true,
      flowBranchesJson: true,
      priority: true,
      conditionKey: true,
      conditionOperator: true,
      conditionValue: true,
      notifyTelegram: true,
      notifyEmail: true,
      notifyEmailTo: true,
      emailSubjectTemplate: true,
      emailBodyTemplate: true,
      webhookUrl: true,
      webhookPayloadTemplate: true,
      actionRetryAttempts: true,
      actionRetryBackoffSec: true,
      createFlowTask: true,
      flowTaskTitle: true,
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
}

async function postAutomationWebhook(url: string, payload: Record<string, unknown>): Promise<void> {
  const u = url.trim();
  if (!u.startsWith("http://") && !u.startsWith("https://")) throw new Error("Webhook URL non valida.");
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);
  try {
    const res = await fetch(u, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`Webhook HTTP ${res.status}`);
  } finally {
    clearTimeout(t);
  }
}

async function sendAutomationEmail(to: string, subject: string, text: string): Promise<void> {
  const recipient = to.trim();
  if (!recipient.includes("@")) throw new Error("Destinatario email non valido.");
  const sent = await sendEmailViaSmtp({ to: recipient, subject, text });
  if (!sent.ok) throw new Error(sent.error);
}

type FlowTaskContext = { clientId: string; titleSuffix: string };
type TemplateVars = Record<string, string | number | boolean | null | undefined>;

function varsToStringMap(vars: TemplateVars): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    if (v == null) continue;
    out[k] = String(v);
  }
  return out;
}

function renderTemplate(template: string, vars: TemplateVars): string {
  const map = varsToStringMap(vars);
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => map[key] ?? "");
}

function ruleMatchesCondition(rule: AutomationRuleActionRow, vars: TemplateVars): boolean {
  const key = rule.conditionKey?.trim();
  const expected = rule.conditionValue?.trim();
  const op = (rule.conditionOperator || "EQ").trim().toUpperCase();
  if (!key) return true;
  if (!expected && op !== "NEQ") return true;
  const actual = vars[key];
  if (actual == null) return false;
  const actualStr = String(actual).trim();
  const expectedStr = (expected ?? "").trim();
  const aLower = actualStr.toLowerCase();
  const eLower = expectedStr.toLowerCase();

  const aNum = Number(actualStr.replace(",", "."));
  const eNum = Number(expectedStr.replace(",", "."));
  const hasNum = Number.isFinite(aNum) && Number.isFinite(eNum);

  const aDate = Date.parse(actualStr);
  const eDate = Date.parse(expectedStr);
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
    case "IN": {
      const list = expectedStr
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      return list.includes(aLower);
    }
    case "DATE_BEFORE":
      return hasDate ? aDate < eDate : false;
    case "DATE_AFTER":
      return hasDate ? aDate > eDate : false;
    case "EQ":
    default:
      return aLower === eLower;
  }
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithRetry(
  action: () => Promise<void>,
  retryAttempts: number,
  backoffSec: number
): Promise<{ ok: boolean; attempts: number; error: string | null }> {
  const tries = clampInt(retryAttempts, 0, 5);
  const backoff = clampInt(backoffSec, 1, 60);
  let attempt = 0;
  while (attempt <= tries) {
    try {
      await action();
      return { ok: true, attempts: attempt + 1, error: null };
    } catch (e) {
      if (attempt >= tries) {
        return {
          ok: false,
          attempts: attempt + 1,
          error: e instanceof Error ? e.message.slice(0, 500) : "Errore esecuzione",
        };
      }
      const waitMs = backoff * 1000 * Math.pow(2, attempt);
      await sleep(waitMs);
    }
    attempt += 1;
  }
  return { ok: false, attempts: tries + 1, error: "Errore sconosciuto" };
}

async function logAutomationExecution(input: {
  ruleId: string;
  channel: "CONDITION" | "TELEGRAM" | "EMAIL" | "WEBHOOK" | "FLOW" | "SIMULATION";
  success: boolean;
  attemptCount?: number;
  errorDetail?: string | null;
  payload?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await prisma.automationRuleExecution.create({
      data: {
        ruleId: input.ruleId,
        channel: input.channel,
        success: input.success,
        attemptCount: input.attemptCount ?? 1,
        errorDetail: input.errorDetail ?? null,
        payloadJson: input.payload ? JSON.stringify(input.payload).slice(0, 10000) : null,
      },
    });
  } catch {
    // ignore log failures
  }
}

/**
 * Telegram: un solo messaggio se almeno una regola ha notifyTelegram.
 * Webhook / Flow: una iterazione per regola (owner della regola).
 */
export async function executeAutomationRules(
  rules: AutomationRuleActionRow[],
  opts: {
    telegramBody: string;
    emailSubject: string;
    emailBody: string;
    webhookPayloadBase: Record<string, unknown>;
    templateVars: TemplateVars;
    /** Se assente, createFlowTask sulle regole viene ignorato. */
    flowTaskContext?: FlowTaskContext;
    /** Se false, non creare task Flow (es. snapshot finance). */
    allowFlowTasks?: boolean;
  }
): Promise<void> {
  const skipped = rules.filter((r) => !ruleMatchesCondition(r, opts.templateVars));
  let eligible = rules.filter((r) => ruleMatchesCondition(r, opts.templateVars));
  const branchMap = new Map(eligible.map((r) => [r.id, r.flowBranchesJson ?? null]));
  eligible = filterRulesWithParallelBranches(eligible, opts.templateVars, branchMap);
  for (const r of skipped) {
    await logAutomationExecution({
      ruleId: r.id,
      channel: "CONDITION",
      success: false,
      errorDetail: "Condizione non soddisfatta",
      payload: { trigger: opts.templateVars.trigger ?? null },
    });
  }
  if (eligible.length === 0) return;
  const allowFlow = opts.allowFlowTasks !== false && opts.flowTaskContext != null;

  const anyTelegram = eligible.some((r) => r.notifyTelegram);
  let telegramSuccess = true;
  let telegramError: string | null = null;
  if (anyTelegram) {
    try {
      await notifyAdminsViaTelegram(opts.telegramBody);
    } catch (e) {
      telegramSuccess = false;
      telegramError = e instanceof Error ? e.message.slice(0, 500) : "Errore invio Telegram";
    }
  }
  for (const r of eligible) {
    if (r.notifyTelegram) {
      await logAutomationExecution({
        ruleId: r.id,
        channel: "TELEGRAM",
        success: telegramSuccess,
        errorDetail: telegramError,
      });
    }
  }

  const parallelTasks: (() => Promise<void>)[] = [];

  for (const r of eligible) {
    const emailSubject = r.emailSubjectTemplate?.trim()
      ? renderTemplate(r.emailSubjectTemplate, opts.templateVars)
      : opts.emailSubject;
    const emailBody = r.emailBodyTemplate?.trim()
      ? renderTemplate(r.emailBodyTemplate, opts.templateVars)
      : opts.emailBody;
    const webhookPayload = r.webhookPayloadTemplate?.trim()
      ? (() => {
          try {
            const rendered = renderTemplate(r.webhookPayloadTemplate!, opts.templateVars);
            return JSON.parse(rendered) as Record<string, unknown>;
          } catch {
            return opts.webhookPayloadBase;
          }
        })()
      : opts.webhookPayloadBase;

    if (r.notifyEmail && r.notifyEmailTo?.trim()) {
      parallelTasks.push(async () => {
        const emailRes = await runWithRetry(
          async () => {
            await sendAutomationEmail(r.notifyEmailTo!, emailSubject, emailBody);
          },
          r.actionRetryAttempts,
          r.actionRetryBackoffSec
        );
        await logAutomationExecution({
          ruleId: r.id,
          channel: "EMAIL",
          success: emailRes.ok,
          attemptCount: emailRes.attempts,
          errorDetail: emailRes.error,
        });
      });
    }
    if (r.webhookUrl?.trim()) {
      parallelTasks.push(async () => {
        const whRes = await runWithRetry(
          async () => {
            await postAutomationWebhook(r.webhookUrl!, {
              ...webhookPayload,
              ruleOwnerUserId: r.ownerUserId,
            });
          },
          r.actionRetryAttempts,
          r.actionRetryBackoffSec
        );
        await logAutomationExecution({
          ruleId: r.id,
          channel: "WEBHOOK",
          success: whRes.ok,
          attemptCount: whRes.attempts,
          errorDetail: whRes.error,
        });
      });
    }
    if (allowFlow && r.createFlowTask && opts.flowTaskContext) {
      const title = (r.flowTaskTitle?.trim() || `Auto: ${opts.flowTaskContext.titleSuffix}`).slice(0, 500);
      try {
        await prisma.flowTask.create({
          data: {
            title,
            ownerUserId: r.ownerUserId,
            relatedClientId: opts.flowTaskContext.clientId,
            source: "automation",
          },
        });
        await logAutomationExecution({ ruleId: r.id, channel: "FLOW", success: true });
      } catch {
        await logAutomationExecution({
          ruleId: r.id,
          channel: "FLOW",
          success: false,
          errorDetail: "Errore creazione task flow",
        });
      }
    }
  }

  if (parallelTasks.length > 0) {
    await runRuleActionsInParallel(parallelTasks);
  }
}

async function resolveTicketAutomationOwnerIds(clientId: string): Promise<string[]> {
  const set = new Set<string>();
  const [opps, tasks, memories] = await Promise.all([
    prisma.opportunity.findMany({
      where: { clientId },
      select: { ownerUserId: true },
      distinct: ["ownerUserId"],
    }),
    prisma.flowTask.findMany({
      where: { relatedClientId: clientId },
      select: { ownerUserId: true },
      distinct: ["ownerUserId"],
    }),
    prisma.memoryItem.findMany({
      where: { relatedClientId: clientId },
      select: { ownerUserId: true },
      distinct: ["ownerUserId"],
    }),
  ]);
  for (const o of opps) set.add(o.ownerUserId);
  for (const f of tasks) set.add(f.ownerUserId);
  for (const m of memories) set.add(m.ownerUserId);
  return Array.from(set);
}

/**
 * Dopo creazione lead (form admin, lead banco, portale segnalatore).
 * Task Flow opzionale solo se in futuro si passa clientId (lead già collegato a cliente).
 */
export async function runLeadCreatedAutomationRules(
  ownerUserId: string,
  leadId: string,
  title: string,
  opts?: { relatedClientId?: string | null }
): Promise<void> {
  const rules = await loadRules(ownerUserId, "LEAD_CREATED");
  if (rules.length === 0) return;

  const base = publicBaseUrl();
  const path = `/admin/crm/leads/${leadId}/edit`;
  const url = base ? `${base}${path}` : path;

  const clientId = opts?.relatedClientId?.trim() || null;
  await executeAutomationRules(rules, {
    telegramBody: `Auto · nuovo lead\n${title}\n${url}`,
    emailSubject: `[Onizuka] Auto lead creato: ${title.slice(0, 80)}`,
    emailBody: `Trigger: LEAD_CREATED\nLead: ${title}\nURL: ${url}`,
    webhookPayloadBase: { trigger: "LEAD_CREATED" as const, leadId, title, url },
    templateVars: {
      trigger: "LEAD_CREATED",
      leadId,
      title,
      url,
    },
    flowTaskContext: clientId ? { clientId, titleSuffix: `lead · ${title.slice(0, 80)}` } : undefined,
  });
}

/**
 * Esegue regole in-app dopo approvazione post (es. notifica Telegram).
 * Si applica solo se il post ha `createdByUserId` (autore interno).
 */
export async function runPostApprovedAutomationRules(postId: string): Promise<void> {
  const post = await prisma.postItem.findUnique({
    where: { id: postId },
    include: { client: { select: { companyName: true } } },
  });
  if (!post || post.status !== "APPROVED" || !post.createdByUserId) return;

  const rules = await loadRules(post.createdByUserId, "POST_APPROVED");
  if (rules.length === 0) return;

  const base = publicBaseUrl();
  const path = `/admin/posts/${postId}`;
  const url = base ? `${base}${path}` : path;

  await executeAutomationRules(rules, {
    telegramBody: `Auto · post approvato\n${post.client.companyName} · ${post.platform}\n${url}`,
    emailSubject: `[Onizuka] Auto post approvato (${post.platform})`,
    emailBody: `Trigger: POST_APPROVED\nCliente: ${post.client.companyName}\nPiattaforma: ${post.platform}\nURL: ${url}`,
    webhookPayloadBase: {
      trigger: "POST_APPROVED" as const,
      postId,
      clientId: post.clientId,
      platform: post.platform,
      url,
    },
    templateVars: {
      trigger: "POST_APPROVED",
      postId,
      clientId: post.clientId,
      platform: post.platform,
      clientName: post.client.companyName,
      url,
    },
    flowTaskContext: { clientId: post.clientId, titleSuffix: `post approvato · ${post.platform}` },
  });
}

/**
 * Ticket creato dal portale cliente: regole TICKET_CREATED per owner CRM legati al cliente
 * (opportunità / task / memorie con stesso clientId). Se nessun owner trovato, le regole non partono
 * (restano le notifiche in-app globali).
 */
export async function runTicketCreatedAutomationRules(
  clientId: string,
  ticketId: string,
  title: string
): Promise<void> {
  const ownerIds = await resolveTicketAutomationOwnerIds(clientId);
  const rules: AutomationRuleActionRow[] = [];
  for (const oid of ownerIds) {
    rules.push(...(await loadRules(oid, "TICKET_CREATED")));
  }
  if (rules.length === 0) return;

  const base = publicBaseUrl();
  const path = `/admin/client-portal/tickets`;
  const url = base ? `${base}${path}` : path;

  await executeAutomationRules(rules, {
    telegramBody: `Auto · nuovo ticket cliente\n${title}\n${url}`,
    emailSubject: `[Onizuka] Auto ticket creato: ${title.slice(0, 80)}`,
    emailBody: `Trigger: TICKET_CREATED\nTicket: ${title}\nURL: ${url}`,
    webhookPayloadBase: {
      trigger: "TICKET_CREATED" as const,
      ticketId,
      clientId,
      title,
      url,
    },
    templateVars: {
      trigger: "TICKET_CREATED",
      ticketId,
      clientId,
      title,
      url,
    },
    flowTaskContext: { clientId, titleSuffix: `ticket · ${title.slice(0, 80)}` },
  });
}

/**
 * Dopo sync scadenze finance (cron): per ogni utente con regola attiva, se ha voci OVERDUE invia Telegram/webhook.
 * Non crea task Flow (allowFlowTasks: false).
 */
export async function runFinanceOverdueSnapshotAutomationRules(): Promise<{ ownersNotified: number }> {
  const rows = await prisma.automationRule.findMany({
    where: { enabled: true, trigger: "FINANCE_OVERDUE_SNAPSHOT" },
    select: {
      id: true,
      ownerUserId: true,
      priority: true,
      conditionKey: true,
      conditionOperator: true,
      conditionValue: true,
      notifyTelegram: true,
      notifyEmail: true,
      notifyEmailTo: true,
      emailSubjectTemplate: true,
      emailBodyTemplate: true,
      webhookUrl: true,
      webhookPayloadTemplate: true,
      actionRetryAttempts: true,
      actionRetryBackoffSec: true,
      createFlowTask: true,
      flowTaskTitle: true,
    },
    orderBy: [{ ownerUserId: "asc" }, { priority: "asc" }, { createdAt: "asc" }],
  });
  if (rows.length === 0) return { ownersNotified: 0 };

  const byOwner = new Map<string, AutomationRuleActionRow[]>();
  for (const r of rows) {
    const list = byOwner.get(r.ownerUserId) ?? [];
    list.push(r);
    byOwner.set(r.ownerUserId, list);
  }

  let ownersNotified = 0;
  const base = publicBaseUrl();
  const path = `/admin/finance`;
  const url = base ? `${base}${path}` : path;

  for (const [ownerUserId, rules] of Array.from(byOwner.entries())) {
    const overdueCount = await prisma.financeEntry.count({
      where: { ownerUserId, status: "OVERDUE" },
    });
    if (overdueCount === 0) continue;
    ownersNotified += 1;
    await executeAutomationRules(rules, {
      telegramBody: `Auto · finance OVERDUE\n${overdueCount} voci in ritardo (tuo owner)\n${url}`,
      emailSubject: `[Onizuka] Auto finance OVERDUE (${overdueCount})`,
      emailBody: `Trigger: FINANCE_OVERDUE_SNAPSHOT\nVoci OVERDUE: ${overdueCount}\nURL: ${url}`,
      webhookPayloadBase: {
        trigger: "FINANCE_OVERDUE_SNAPSHOT" as const,
        overdueCount,
        ownerUserId,
        url,
      },
      templateVars: {
        trigger: "FINANCE_OVERDUE_SNAPSHOT",
        overdueCount,
        ownerUserId,
        url,
      },
      allowFlowTasks: false,
    });
  }

  return { ownersNotified };
}

/**
 * Dopo invio effettivo Reach (SMTP/Gmail API o “segna inviata” in UI).
 */
export async function runReachDraftSentAutomationRules(
  ownerUserId: string,
  payload: {
    draftId: string;
    subject: string;
    clientId: string | null;
    clientName: string | null;
  }
): Promise<void> {
  const rules = await loadRules(ownerUserId, "REACH_DRAFT_SENT");
  if (rules.length === 0) return;

  const base = publicBaseUrl();
  const path = `/admin/reach`;
  const url = base ? `${base}${path}` : path;

  await executeAutomationRules(rules, {
    telegramBody: `Auto · Reach inviato\n${payload.subject}\n${payload.clientName ?? "Senza cliente"}\n${url}`,
    emailSubject: `[Onizuka] Auto Reach inviato`,
    emailBody: `Trigger: REACH_DRAFT_SENT\nOggetto: ${payload.subject}\nCliente: ${payload.clientName ?? "n/a"}\nURL: ${url}`,
    webhookPayloadBase: {
      trigger: "REACH_DRAFT_SENT" as const,
      draftId: payload.draftId,
      subject: payload.subject,
      clientId: payload.clientId,
      clientName: payload.clientName,
      url,
    },
    templateVars: {
      trigger: "REACH_DRAFT_SENT",
      draftId: payload.draftId,
      subject: payload.subject,
      clientId: payload.clientId,
      clientName: payload.clientName,
      url,
    },
    flowTaskContext: payload.clientId
      ? { clientId: payload.clientId, titleSuffix: `Reach · ${payload.subject.slice(0, 80)}` }
      : undefined,
  });
}

/**
 * Dopo creazione voce Finance di tipo INCOME.
 */
export async function runFinanceIncomeCreatedAutomationRules(
  ownerUserId: string,
  payload: { entryId: string; label: string; amountEur: number; clientId: string | null }
): Promise<void> {
  const rules = await loadRules(ownerUserId, "FINANCE_INCOME_CREATED");
  if (rules.length === 0) return;

  const base = publicBaseUrl();
  const path = "/admin/finance";
  const url = base ? `${base}${path}` : path;

  await executeAutomationRules(rules, {
    telegramBody: `Auto · nuova entrata finance\n${payload.label}\n€ ${payload.amountEur.toLocaleString("it-IT", {
      maximumFractionDigits: 2,
    })}\n${url}`,
    emailSubject: `[Onizuka] Auto entrata finance creata`,
    emailBody: `Trigger: FINANCE_INCOME_CREATED\nVoce: ${payload.label}\nImporto: € ${payload.amountEur}\nURL: ${url}`,
    webhookPayloadBase: {
      trigger: "FINANCE_INCOME_CREATED" as const,
      entryId: payload.entryId,
      label: payload.label,
      amountEur: payload.amountEur,
      clientId: payload.clientId,
      url,
    },
    templateVars: {
      trigger: "FINANCE_INCOME_CREATED",
      entryId: payload.entryId,
      label: payload.label,
      amountEur: payload.amountEur,
      clientId: payload.clientId,
      url,
    },
    flowTaskContext: payload.clientId
      ? { clientId: payload.clientId, titleSuffix: `finance entrata · ${payload.label.slice(0, 80)}` }
      : undefined,
  });
}

/** Dopo messaggio WhatsApp in ingresso (webhook Meta). */
export async function runWhatsAppInboundAutomationRules(payload: {
  messageId: string;
  phoneFrom: string;
  body: string | null;
}): Promise<void> {
  const ownerRows = await prisma.automationRule.findMany({
    where: { enabled: true, trigger: "WHATSAPP_INBOUND" },
    select: { ownerUserId: true },
    distinct: ["ownerUserId"],
  });

  const base = publicBaseUrl();
  const url = base ? `${base}/admin/settings` : "/admin/settings";
  const preview = (payload.body ?? "").slice(0, 200);

  for (const { ownerUserId } of ownerRows) {
    const rules = await loadRules(ownerUserId, "WHATSAPP_INBOUND");
    if (rules.length === 0) continue;

    await executeAutomationRules(rules, {
      telegramBody: `Auto · WhatsApp inbound\n+${payload.phoneFrom}\n${preview || "—"}\n${url}`,
      emailSubject: `[Onizuka] WhatsApp · +${payload.phoneFrom}`,
      emailBody: `Trigger: WHATSAPP_INBOUND\nDa: +${payload.phoneFrom}\nTesto: ${preview || "—"}\nURL: ${url}`,
      webhookPayloadBase: {
        trigger: "WHATSAPP_INBOUND" as const,
        messageId: payload.messageId,
        phoneFrom: payload.phoneFrom,
        body: payload.body,
        url,
      },
      templateVars: {
        trigger: "WHATSAPP_INBOUND",
        messageId: payload.messageId,
        phoneFrom: payload.phoneFrom,
        body: preview,
        url,
      },
      allowFlowTasks: false,
    });
  }
}
