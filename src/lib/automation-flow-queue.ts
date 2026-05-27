import type { AutomationFlowRunStatus } from "@prisma/client";
import { parseFlowBranchesJson } from "@/lib/automation-branches";
import { runAutomationSandbox } from "@/lib/automation-sandbox";
import { defaultSimulationVarsForTrigger } from "@/lib/automation-simulation-presets";
import { loadRules, executeAutomationRules } from "@/lib/automation-rules-run";
import {
  isAutomationRedisQueueEnabled,
  redisDequeueAutomationRuns,
  redisEnqueueAutomationRun,
  redisPushAutomationDeadLetter,
} from "@/lib/automation-flow-redis";
import {
  isAutomationSqsQueueEnabled,
  sqsDequeueAutomationRuns,
  sqsEnqueueAutomationRun,
  sqsPushAutomationDeadLetter,
} from "@/lib/automation-flow-sqs";
import { prisma } from "@/lib/prisma";

function publicBaseUrl(): string {
  return (
    process.env.ONIZUKA_PRIMARY_HOST?.replace(/\/$/, "") ??
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    ""
  );
}

const MAX_ATTEMPTS = 3;

/** Accoda esecuzione distribuita per regola (branch opzionale). */
export async function enqueueAutomationFlowRun(params: {
  ruleId: string;
  ownerUserId: string;
  branchId?: string | null;
  payloadJson?: Record<string, unknown>;
  delayMs?: number;
}): Promise<string> {
  const scheduledAt = new Date(Date.now() + (params.delayMs ?? 0));
  const row = await prisma.automationFlowRun.create({
    data: {
      ruleId: params.ruleId,
      ownerUserId: params.ownerUserId,
      branchId: params.branchId ?? null,
      payloadJson: JSON.stringify(params.payloadJson ?? {}).slice(0, 10000),
      scheduledAt,
    },
  });
  if (isAutomationSqsQueueEnabled()) {
    await sqsEnqueueAutomationRun(row.id);
  } else if (isAutomationRedisQueueEnabled()) {
    await redisEnqueueAutomationRun(row.id);
  }
  return row.id;
}

async function processSingleFlowRun(
  run: Awaited<ReturnType<typeof loadFlowRunById>>
): Promise<"done" | "failed" | "retry"> {
  if (!run) return "failed";

  await prisma.automationFlowRun.update({
    where: { id: run.id },
    data: { status: "RUNNING", startedAt: new Date(), attemptCount: { increment: 1 } },
  });

  try {
    if (!run.rule.enabled) {
      await finishRun(run.id, "DONE", "Regola disattivata — skip.");
      return "done";
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(run.payloadJson) as Record<string, unknown>;
    } catch {
      payload = {};
    }

    const branches = parseFlowBranchesJson(run.rule.flowBranchesJson);
    if (run.branchId && branches.length > 0) {
      const branch = branches.find((b) => b.id === run.branchId);
      if (!branch) {
        await moveToDeadLetter(run, `Branch ${run.branchId} non trovato.`);
        return "failed";
      }
      const sandbox = runAutomationSandbox({
        trigger: run.rule.trigger,
        conditionKey: branch.conditionKey ?? run.rule.conditionKey,
        conditionOperator: branch.conditionOperator ?? run.rule.conditionOperator,
        conditionValue: branch.conditionValue ?? run.rule.conditionValue,
        emailSubjectTemplate: run.rule.emailSubjectTemplate,
        emailBodyTemplate: run.rule.emailBodyTemplate,
        webhookPayloadTemplate: run.rule.webhookPayloadTemplate,
        flowBranchesJson: JSON.stringify({ branches: [branch] }),
        defaultVars: defaultSimulationVarsForTrigger(run.rule.trigger),
        payloadJson: JSON.stringify(payload),
      });
      if ("error" in sandbox || !sandbox.matched) {
        await finishRun(run.id, "DONE", "Branch non match — skip azioni.");
        return "done";
      }
    }

    const rules = await loadRules(run.ownerUserId, run.rule.trigger);
    const vars: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") vars[k] = String(v);
    }
    vars.trigger = run.rule.trigger;
    await executeAutomationRules(rules, {
      telegramBody: `Auto coda · ${run.rule.trigger}\n${JSON.stringify(payload).slice(0, 500)}`,
      emailSubject: `[Onizuka] Coda automazione ${run.rule.trigger}`,
      emailBody: JSON.stringify(payload, null, 2).slice(0, 4000),
      webhookPayloadBase: { ...payload, flowRunId: run.id, branchId: run.branchId },
      templateVars: vars,
    });

    await finishRun(run.id, "DONE", null);
    return "done";
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 500) : "Errore esecuzione";
    const attempts = run.attemptCount + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await moveToDeadLetter(run, msg);
      return "failed";
    }
    await prisma.automationFlowRun.update({
      where: { id: run.id },
      data: { status: "PENDING", errorDetail: msg },
    });
    return "retry";
  }
}

async function loadFlowRunById(id: string) {
  return prisma.automationFlowRun.findUnique({
    where: { id },
    include: {
      rule: {
        select: {
          id: true,
          trigger: true,
          ownerUserId: true,
          enabled: true,
          conditionKey: true,
          conditionOperator: true,
          conditionValue: true,
          flowBranchesJson: true,
          emailSubjectTemplate: true,
          emailBodyTemplate: true,
          webhookPayloadTemplate: true,
        },
      },
    },
  });
}

async function moveToDeadLetter(
  run: NonNullable<Awaited<ReturnType<typeof loadFlowRunById>>>,
  errorDetail: string
) {
  await prisma.automationFlowRun.update({
    where: { id: run.id },
    data: { status: "FAILED", completedAt: new Date(), errorDetail },
  });
  await prisma.automationFlowRunDeadLetter.create({
    data: {
      flowRunId: run.id,
      ruleId: run.ruleId,
      ownerUserId: run.ownerUserId,
      payloadJson: run.payloadJson,
      errorDetail,
    },
  });
  const dlqPayload = JSON.stringify({ runId: run.id, ruleId: run.ruleId, error: errorDetail });
  void redisPushAutomationDeadLetter(dlqPayload);
  void sqsPushAutomationDeadLetter(dlqPayload);
}

/** Processa step PENDING (cron + Redis multi-worker). */
export async function processAutomationFlowQueue(limit = 20): Promise<{
  processed: number;
  done: number;
  failed: number;
  redisDepth?: { queue: number; dlq: number };
  sqsDepth?: { queue: number; dlq: number } | null;
}> {
  const runIds = isAutomationSqsQueueEnabled()
    ? await sqsDequeueAutomationRuns(limit)
    : isAutomationRedisQueueEnabled()
      ? await redisDequeueAutomationRuns(limit)
      : [];
  let done = 0;
  let failed = 0;
  let processed = 0;

  for (const id of runIds) {
    const run = await loadFlowRunById(id);
    const result = await processSingleFlowRun(run);
    processed += 1;
    if (result === "done") done += 1;
    else if (result === "failed") failed += 1;
  }

  const remaining = Math.max(0, limit - processed);
  const pending =
    remaining > 0
      ? await prisma.automationFlowRun.findMany({
          where: {
            status: "PENDING",
            scheduledAt: { lte: new Date() },
            attemptCount: { lt: MAX_ATTEMPTS },
          },
          orderBy: { scheduledAt: "asc" },
          take: remaining,
          include: {
            rule: {
              select: {
                id: true,
                trigger: true,
                ownerUserId: true,
                enabled: true,
                conditionKey: true,
                conditionOperator: true,
                conditionValue: true,
                flowBranchesJson: true,
                emailSubjectTemplate: true,
                emailBodyTemplate: true,
                webhookPayloadTemplate: true,
              },
            },
          },
        })
      : [];

  for (const run of pending) {
    const result = await processSingleFlowRun(run);
    processed += 1;
    if (result === "done") done += 1;
    else if (result === "failed") failed += 1;
  }

  const { redisAutomationQueueDepth } = await import("@/lib/automation-flow-redis");
  const { sqsAutomationQueueDepth } = await import("@/lib/automation-flow-sqs");
  const redisDepth = isAutomationRedisQueueEnabled() ? await redisAutomationQueueDepth() : undefined;
  const sqsDepth = isAutomationSqsQueueEnabled() ? await sqsAutomationQueueDepth() : null;

  return { processed, done, failed, redisDepth, sqsDepth };
}

async function finishRun(id: string, status: AutomationFlowRunStatus, errorDetail: string | null) {
  await prisma.automationFlowRun.update({
    where: { id },
    data: { status, completedAt: new Date(), errorDetail },
  });
}
