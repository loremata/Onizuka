export type DayCount = { day: string; label: string; count: number };

/** YYYY-MM-DD in local timezone (avoids UTC shift in bucket matching). */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function bucketCountsByDay(dates: Date[], days: number, locale = "it-IT"): DayCount[] {
  const buckets: DayCount[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" });

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    buckets.push({ day: key, label: fmt.format(d), count: 0 });
  }

  for (const dt of dates) {
    const key = localDateKey(new Date(dt));
    const bucket = buckets.find((b) => b.day === key);
    if (bucket) bucket.count += 1;
  }

  return buckets;
}
