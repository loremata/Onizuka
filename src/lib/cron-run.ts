import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * BATTITO DEI LAVORI NOTTURNI.
 *
 * `withCronRun` avvolge l'handler di una route cron e registra ogni esecuzione
 * su `CronRun`. Non tocca la logica: prende l'handler esistente, misura, salva.
 *
 * Due cose che prima erano invisibili diventano visibili:
 *  - un run che FALLISCE (eccezione o status >= 400) lascia una riga ok=false;
 *  - un run TRONCATO dal timeout della funzione lascia una riga con
 *    `finishedAt` nullo e `startedAt` vecchio: e' la firma inconfondibile del
 *    timeout, che per definizione non puo' loggare nulla da solo.
 *
 * Le richieste non autorizzate (401) NON vengono registrate: sono probe, non
 * esecuzioni, e sporcherebbero il battito.
 */

/** Quanto puo' tacere un cron prima che sia un problema. */
export type CronExpectation = {
  name: string;
  label: string;
  /** Schedule leggibile (per la UI). */
  schedule: string;
  /** Oltre queste ore senza un run OK, scatta l'allarme. ~2x l'intervallo. */
  maxSilenceHours: number;
};

/**
 * I cron attesi in produzione, allineati a `vercel.json`. Se aggiungi un cron
 * la', aggiungilo QUI: e' questa lista che decide su cosa suona la sveglia.
 */
export const CRON_EXPECTATIONS: CronExpectation[] = [
  { name: "notifications", label: "Notifiche e digest giornaliero", schedule: "06:00 UTC", maxSilenceHours: 26 },
  { name: "webhook-retry", label: "Riprova webhook falliti", schedule: "ogni 15 min", maxSilenceHours: 2 },
  { name: "reach-sequences", label: "Sequenze outreach", schedule: "08:00 UTC", maxSilenceHours: 26 },
  { name: "audit-sheet-queue", label: "Coda audit da Sheet", schedule: "06:00 UTC", maxSilenceHours: 26 },
  { name: "scraping-audit", label: "Coda audit da scraping", schedule: "ogni 3 ore", maxSilenceHours: 7 },
  { name: "automation-queue", label: "Coda automazioni", schedule: "ogni 10 min", maxSilenceHours: 2 },
  { name: "dedupe-training", label: "Training modello duplicati", schedule: "04:30 UTC", maxSilenceHours: 26 },
  { name: "social-publish", label: "Pubblicazione post social", schedule: "ogni 15 min", maxSilenceHours: 2 },
  { name: "social-metrics", label: "Metriche social", schedule: "ogni 6 ore", maxSilenceHours: 13 },
  { name: "social-insights", label: "Insight social", schedule: "07:00 UTC", maxSilenceHours: 26 },
  { name: "analytics-ga4", label: "Sync Google Analytics", schedule: "05:00 UTC", maxSilenceHours: 26 },
  { name: "social-snapshots", label: "Snapshot account social", schedule: "05:30 UTC", maxSilenceHours: 26 },
  { name: "analytics-ads", label: "Sync campagne Ads", schedule: "06:00 UTC", maxSilenceHours: 26 },
  { name: "campaign-tick", label: "Motore campagne (simulazione)", schedule: "09:00 UTC", maxSilenceHours: 26 },
];

/** Oltre questo tempo un run ancora "aperto" e' considerato troncato. */
export const CRON_STUCK_AFTER_MINUTES = 30;

const MAX_RESULT_CHARS = 2000;

function truncate(s: string): string {
  return s.length > MAX_RESULT_CHARS ? `${s.slice(0, MAX_RESULT_CHARS)}…` : s;
}

type CronHandler = (request: NextRequest) => Promise<Response>;

export function withCronRun(name: string, handler: CronHandler): CronHandler {
  return async (request: NextRequest): Promise<Response> => {
    const startedAt = Date.now();

    // Riga aperta PRIMA di eseguire: se la funzione viene troncata dal timeout
    // resta li' a testimoniarlo. E' l'unico modo di vedere un timeout.
    let runId: string | null = null;
    try {
      const row = await prisma.cronRun.create({ data: { name }, select: { id: true } });
      runId = row.id;
    } catch {
      // Il battito non deve MAI impedire al lavoro di girare.
    }

    const close = async (data: {
      ok: boolean;
      httpStatus?: number;
      resultJson?: string | null;
      errorDetail?: string | null;
    }) => {
      if (!runId) return;
      await prisma.cronRun
        .update({
          where: { id: runId },
          data: {
            finishedAt: new Date(),
            durationMs: Date.now() - startedAt,
            ok: data.ok,
            httpStatus: data.httpStatus,
            resultJson: data.resultJson ?? null,
            errorDetail: data.errorDetail ?? null,
          },
        })
        .catch(() => undefined);
    };

    try {
      const response = await handler(request);

      // 401 = probe non autorizzata, non un'esecuzione: si scarta la riga.
      if (response.status === 401) {
        if (runId) await prisma.cronRun.delete({ where: { id: runId } }).catch(() => undefined);
        return response;
      }

      // Il corpo si legge da un clone: l'originale deve restare intatto.
      let resultJson: string | null = null;
      try {
        resultJson = truncate(await response.clone().text());
      } catch {
        resultJson = null;
      }

      await close({ ok: response.ok, httpStatus: response.status, resultJson });
      return response;
    } catch (e) {
      const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      await close({ ok: false, errorDetail: truncate(detail) });
      throw e;
    }
  };
}

/** Pulizia: il battito non deve diventare la tabella piu' pesante del database. */
export async function purgeOldCronRuns(days = 30): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const res = await prisma.cronRun.deleteMany({ where: { startedAt: { lt: cutoff } } });
  return res.count;
}
