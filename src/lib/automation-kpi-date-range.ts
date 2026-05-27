const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000;

export type AutomationKpiRange = {
  from: Date;
  to: Date;
  /** YYYY-MM-DD for form/query */
  fromDay: string;
  toDay: string;
};

function dayStartUtc(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

function dayEndUtc(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T23:59:59.999Z`);
}

function isDay(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * KPI / export window: optional from/to (UTC calendar days), default last 7 days through today UTC,
 * swap if inverted, cap span at 90 days ending at `to`.
 */
export function resolveAutomationKpiRange(input: {
  from?: string | null;
  to?: string | null;
  defaultDays?: number;
}): AutomationKpiRange {
  const defaultDays = input.defaultDays ?? 7;
  const now = new Date();
  const defaultToDay = now.toISOString().slice(0, 10);
  const defaultFromDay = new Date(now.getTime() - defaultDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const fromDay = isDay(input.from) ? input.from : defaultFromDay;
  const toDay = isDay(input.to) ? input.to : defaultToDay;

  let from = dayStartUtc(fromDay);
  let to = dayEndUtc(toDay);
  if (Number.isNaN(from.getTime())) from = dayStartUtc(defaultFromDay);
  if (Number.isNaN(to.getTime())) to = dayEndUtc(defaultToDay);

  if (from.getTime() > to.getTime()) {
    const f = from;
    from = dayStartUtc(to.toISOString().slice(0, 10));
    to = dayEndUtc(f.toISOString().slice(0, 10));
  }

  if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
    from = new Date(to.getTime() - MAX_RANGE_MS);
  }

  return {
    from,
    to,
    fromDay: from.toISOString().slice(0, 10),
    toDay: to.toISOString().slice(0, 10),
  };
}
