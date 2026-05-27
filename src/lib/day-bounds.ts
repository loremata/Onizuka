/** Inizio e fine giornata locale (server) per filtri recap / scadenze. */
export function getLocalDayBounds(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function isValidIanaTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

const DATETIME_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Interpreta una stringa `datetime-local` (senza offset) come orologio civile nel fuso IANA.
 * In caso di ora ambigua (DST) si sceglie il primo istante UTC trovato; in «buco» primaverile → null.
 */
export function parseDateTimeLocalInIanaZone(dueRaw: string, timeZone: string): Date | null {
  const trimmed = dueRaw.trim();
  const m = trimmed.match(DATETIME_LOCAL_RE);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const s = Number(m[6] ?? 0);
  if ([y, mo, d, h, mi, s].some((n) => Number.isNaN(n))) return null;

  const tz = timeZone.trim();
  if (!isValidIanaTimeZone(tz)) return null;

  const partsFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  function readWall(t: Date) {
    const o: Record<string, number> = {};
    for (const p of partsFormatter.formatToParts(t)) {
      if (p.type !== "literal" && p.type !== "timeZoneName") {
        o[p.type] = Number(p.value);
      }
    }
    return o as { year: number; month: number; day: number; hour: number; minute: number; second: number };
  }

  function matches(t: Date) {
    const o = readWall(t);
    return o.year === y && o.month === mo && o.day === d && o.hour === h && o.minute === mi && o.second === s;
  }

  const stepMs = m[6] ? 1000 : 60_000;
  const anchor = Date.UTC(y, mo - 1, d, 12, 0, 0, 0);
  const span = 28 * 3600000;
  for (let delta = -span; delta <= span; delta += stepMs) {
    const t = new Date(anchor + delta);
    if (matches(t)) return t;
  }
  return null;
}

/**
 * Fuso IANA da usare per interpretare `datetime-local` nei task Flow:
 * stessa priorità di {@link resolveRecapDayBounds} (senza fallback «locale server» come IANA).
 */
export function resolveDueInputIanaZone(userTimeZone?: string | null): string | null {
  const u = userTimeZone?.trim();
  if (u && isValidIanaTimeZone(u)) return u;
  const e = process.env.ONIZUKA_RECAP_TIMEZONE?.trim();
  if (e && isValidIanaTimeZone(e)) return e;
  return null;
}

function calendarDateLabelInZone(timeZone: string, instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

function zonedWallClockHms(timeZone: string, instant: Date): { h: string; m: string; s: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const map = Object.fromEntries(
    parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value])
  ) as Record<string, string>;
  return { h: map.hour ?? "00", m: map.minute ?? "00", s: map.second ?? "00" };
}

/**
 * Inizio e fine del giorno civile nel fuso IANA indicato (istanti UTC inclusivi, adatti a filtri Prisma).
 */
export function getDayBoundsInTimeZone(timeZone: string, now = new Date()): { start: Date; end: Date } {
  const tz = timeZone.trim();
  if (!isValidIanaTimeZone(tz)) return getLocalDayBounds(now);

  const calendarLabel = calendarDateLabelInZone(tz, now);
  const [Y, M, D] = calendarLabel.split("-").map(Number);
  const anchorMs = Date.UTC(Y, M - 1, D, 12, 0, 0, 0);

  let start: Date | null = null;
  for (let delta = -36 * 3600000; delta <= 36 * 3600000; delta += 60000) {
    const t = new Date(anchorMs + delta);
    if (calendarDateLabelInZone(tz, t) !== calendarLabel) continue;
    const { h, m, s } = zonedWallClockHms(tz, t);
    if (h === "00" && m === "00" && s === "00") {
      start = t;
      break;
    }
  }
  if (!start) return getLocalDayBounds(now);

  const df = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  let lo = start.getTime();
  let hi = start.getTime() + 36 * 3600000;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (df.format(new Date(mid)) === calendarLabel) lo = mid;
    else hi = mid;
  }
  const end = new Date(lo);

  return { start, end };
}

export type DayBoundsForRecap = { start: Date; end: Date; timeZoneLabel: string };

export type ResolveRecapDayBoundsOpts = {
  /** IANA dal profilo utente (`User.timeZone`). */
  userTimeZone?: string | null;
  now?: Date;
};

/**
 * Priorità: profilo utente → `ONIZUKA_RECAP_TIMEZONE` → mezzanotte locale del server.
 */
export function resolveRecapDayBounds(opts: ResolveRecapDayBoundsOpts = {}): DayBoundsForRecap {
  const now = opts.now ?? new Date();
  const fromUser = opts.userTimeZone?.trim();
  if (fromUser && isValidIanaTimeZone(fromUser)) {
    const { start, end } = getDayBoundsInTimeZone(fromUser, now);
    return { start, end, timeZoneLabel: `${fromUser} (profilo utente)` };
  }
  const fromEnv = process.env.ONIZUKA_RECAP_TIMEZONE?.trim();
  if (fromEnv && isValidIanaTimeZone(fromEnv)) {
    const { start, end } = getDayBoundsInTimeZone(fromEnv, now);
    return { start, end, timeZoneLabel: `${fromEnv} (ONIZUKA_RECAP_TIMEZONE)` };
  }
  const { start, end } = getLocalDayBounds(now);
  return { start, end, timeZoneLabel: "locale server" };
}

/** Alias senza profilo utente (solo env + server locale). */
export function getDayBoundsForRecap(now = new Date()): DayBoundsForRecap {
  return resolveRecapDayBounds({ now });
}
