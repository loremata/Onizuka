import { prisma } from "@/lib/prisma";
import {
  CRON_EXPECTATIONS,
  CRON_STUCK_AFTER_MINUTES,
  type CronExpectation,
} from "@/lib/cron-run";

/**
 * SALUTE DEI LAVORI NOTTURNI — la risposta a "gira ancora tutto?".
 *
 * Tre stati, in ordine di gravita':
 *  - `silent`  : nessun run andato bene entro la finestra attesa. E' il caso
 *                che prima non si vedeva: il cron poteva essere morto da una
 *                settimana e il sistema aveva lo stesso aspetto di sempre.
 *  - `failing` : gira ma l'ultimo run e' fallito.
 *  - `stuck`   : un run e' aperto da troppo tempo = troncato dal timeout.
 *  - `ok`      : ultimo run andato bene dentro la finestra.
 *  - `never`   : mai eseguito da quando esiste il battito (atteso subito dopo
 *                il rilascio, non e' un allarme finche' non scade la finestra).
 */

export type CronHealthStatus = "ok" | "silent" | "failing" | "stuck" | "never";

export type CronHealthRow = CronExpectation & {
  status: CronHealthStatus;
  lastRunAt: Date | null;
  lastOkAt: Date | null;
  lastDurationMs: number | null;
  lastError: string | null;
  hoursSinceOk: number | null;
  /** Run aperto da oltre la soglia: quasi sempre un timeout della funzione. */
  stuckSince: Date | null;
};

export type CronHealthReport = {
  rows: CronHealthRow[];
  problems: CronHealthRow[];
  healthy: boolean;
  /** Versione in produzione: serve a capire se l'ultimo push e' andato online. */
  deployment: { sha: string | null; shortSha: string | null; message: string | null; env: string | null };
};

function deploymentInfo(): CronHealthReport["deployment"] {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null;
  return {
    sha,
    shortSha: sha ? sha.slice(0, 7) : null,
    message: process.env.VERCEL_GIT_COMMIT_MESSAGE?.trim().split("\n")[0] || null,
    env: process.env.VERCEL_ENV?.trim() || null,
  };
}

export async function loadCronHealth(now = new Date()): Promise<CronHealthReport> {
  const names = CRON_EXPECTATIONS.map((c) => c.name);

  // Ultimo run e ultimo run OK per ciascun cron, in due query aggregate.
  const [lastRuns, lastOks, stuckRuns] = await Promise.all([
    prisma.cronRun.findMany({
      where: { name: { in: names } },
      orderBy: { startedAt: "desc" },
      distinct: ["name"],
      select: { name: true, startedAt: true, ok: true, durationMs: true, errorDetail: true },
    }),
    prisma.cronRun.findMany({
      where: { name: { in: names }, ok: true },
      orderBy: { startedAt: "desc" },
      distinct: ["name"],
      select: { name: true, startedAt: true },
    }),
    prisma.cronRun.findMany({
      where: {
        name: { in: names },
        finishedAt: null,
        startedAt: { lt: new Date(now.getTime() - CRON_STUCK_AFTER_MINUTES * 60 * 1000) },
      },
      orderBy: { startedAt: "desc" },
      distinct: ["name"],
      select: { name: true, startedAt: true },
    }),
  ]);

  const lastByName = new Map(lastRuns.map((r) => [r.name, r]));
  const okByName = new Map(lastOks.map((r) => [r.name, r.startedAt]));
  const stuckByName = new Map(stuckRuns.map((r) => [r.name, r.startedAt]));

  const rows: CronHealthRow[] = CRON_EXPECTATIONS.map((exp) => {
    const last = lastByName.get(exp.name) ?? null;
    const lastOkAt = okByName.get(exp.name) ?? null;
    const stuckSince = stuckByName.get(exp.name) ?? null;
    const hoursSinceOk = lastOkAt ? (now.getTime() - lastOkAt.getTime()) / 3_600_000 : null;

    let status: CronHealthStatus;
    if (!last) status = "never";
    else if (hoursSinceOk == null || hoursSinceOk > exp.maxSilenceHours) status = "silent";
    else if (stuckSince) status = "stuck";
    else if (last.ok === false) status = "failing";
    else status = "ok";

    return {
      ...exp,
      status,
      lastRunAt: last?.startedAt ?? null,
      lastOkAt,
      lastDurationMs: last?.durationMs ?? null,
      lastError: last?.errorDetail ?? null,
      hoursSinceOk: hoursSinceOk == null ? null : Math.round(hoursSinceOk * 10) / 10,
      stuckSince,
    };
  });

  // "never" non e' un problema: e' lo stato atteso subito dopo il rilascio del
  // battito, finche' il cron non ha avuto la sua prima occasione di girare.
  const problems = rows.filter((r) => r.status === "silent" || r.status === "failing" || r.status === "stuck");

  return { rows, problems, healthy: problems.length === 0, deployment: deploymentInfo() };
}

export function cronProblemLine(r: CronHealthRow): string {
  switch (r.status) {
    case "silent":
      return r.lastOkAt
        ? `${r.label}: nessun giro riuscito da ${r.hoursSinceOk}h (atteso ${r.schedule}).`
        : `${r.label}: non ha mai completato un giro (atteso ${r.schedule}).`;
    case "failing":
      return `${r.label}: ultimo giro FALLITO${r.lastError ? ` — ${r.lastError.slice(0, 120)}` : ""}.`;
    case "stuck":
      return `${r.label}: un giro è aperto da oltre ${CRON_STUCK_AFTER_MINUTES} min — probabile timeout.`;
    default:
      return `${r.label}: ok.`;
  }
}
