import type { AnalyticsSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type MetricInput = {
  clientId: string;
  source: AnalyticsSource;
  metricKey: string;
  date: Date;
  value: number;
  dimension?: string;
};

/** Normalizza una data al giorno (mezzanotte UTC) per il bucket giornaliero. */
export function dayBucket(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Scrive/aggiorna un punto della serie storica (idempotente per giorno). */
export async function recordMetric(input: MetricInput): Promise<void> {
  const dimension = input.dimension ?? "";
  const date = dayBucket(input.date);
  await prisma.analyticsMetric.upsert({
    where: {
      clientId_source_metricKey_dimension_date: {
        clientId: input.clientId,
        source: input.source,
        metricKey: input.metricKey,
        dimension,
        date,
      },
    },
    create: { clientId: input.clientId, source: input.source, metricKey: input.metricKey, dimension, date, value: input.value },
    update: { value: input.value },
  });
}

/** Scrive un batch di metriche in sequenza (usato dai collector). Ritorna quante ne ha scritte. */
export async function recordMetrics(inputs: MetricInput[]): Promise<number> {
  let n = 0;
  for (const m of inputs) {
    await recordMetric(m);
    n++;
  }
  return n;
}

export type SeriesPoint = { date: Date; value: number };

/** Serie storica giornaliera di una metrica (totale o per dimensione) negli ultimi N giorni. */
export async function getMetricSeries(params: {
  clientId: string;
  source: AnalyticsSource;
  metricKey: string;
  days?: number;
  dimension?: string;
}): Promise<SeriesPoint[]> {
  const days = params.days ?? 30;
  const since = dayBucket(new Date(Date.now() - days * 24 * 3600 * 1000));
  const rows = await prisma.analyticsMetric.findMany({
    where: {
      clientId: params.clientId,
      source: params.source,
      metricKey: params.metricKey,
      dimension: params.dimension ?? "",
      date: { gte: since },
    },
    orderBy: { date: "asc" },
    select: { date: true, value: true },
  });
  return rows;
}

/** Ultimo valore noto di una metrica (o null). */
export async function getLatestMetric(params: {
  clientId: string;
  source: AnalyticsSource;
  metricKey: string;
  dimension?: string;
}): Promise<SeriesPoint | null> {
  const row = await prisma.analyticsMetric.findFirst({
    where: {
      clientId: params.clientId,
      source: params.source,
      metricKey: params.metricKey,
      dimension: params.dimension ?? "",
    },
    orderBy: { date: "desc" },
    select: { date: true, value: true },
  });
  return row;
}

/** Elenco delle metriche disponibili per un cliente (per costruire la dashboard dinamicamente). */
export async function listAvailableMetrics(clientId: string): Promise<
  { source: AnalyticsSource; metricKey: string; points: number; lastDate: Date }[]
> {
  const rows = await prisma.analyticsMetric.groupBy({
    by: ["source", "metricKey"],
    where: { clientId, dimension: "" },
    _count: { _all: true },
    _max: { date: true },
  });
  return rows
    .map((r) => ({ source: r.source, metricKey: r.metricKey, points: r._count._all, lastDate: r._max.date! }))
    .sort((a, b) => (a.source + a.metricKey).localeCompare(b.source + b.metricKey));
}
