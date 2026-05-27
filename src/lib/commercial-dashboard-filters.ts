export type CommercialDashboardPeriod = "7" | "30" | "90" | "all";

export type CommercialDashboardFilters = {
  period: CommercialDashboardPeriod;
  leadStatus?: string;
  opportunityPriority?: string;
  opportunitySource?: string;
  auditScoreMax?: number;
  incompleteOnly: boolean;
};

export function periodToSince(period: CommercialDashboardPeriod): Date | null {
  if (period === "all") return null;
  const days = Number(period);
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function parseCommercialDashboardFilters(
  raw: Record<string, string | string[] | undefined>
): CommercialDashboardFilters {
  const pick = (k: string) => {
    const v = raw[k];
    return typeof v === "string" ? v : v?.[0];
  };

  const periodRaw = pick("period");
  const period: CommercialDashboardPeriod =
    periodRaw === "7" || periodRaw === "30" || periodRaw === "90" || periodRaw === "all"
      ? periodRaw
      : "30";

  const scoreRaw = pick("auditMax");
  const auditScoreMax = scoreRaw ? Number(scoreRaw) : undefined;

  return {
    period,
    leadStatus: pick("leadStatus") || undefined,
    opportunityPriority: pick("oppPriority") || undefined,
    opportunitySource: pick("oppSource") || undefined,
    auditScoreMax: auditScoreMax != null && !Number.isNaN(auditScoreMax) ? auditScoreMax : undefined,
    incompleteOnly: pick("incomplete") === "1",
  };
}

export function filtersToSearchParams(f: CommercialDashboardFilters): string {
  const p = new URLSearchParams();
  if (f.period !== "30") p.set("period", f.period);
  if (f.leadStatus) p.set("leadStatus", f.leadStatus);
  if (f.opportunityPriority) p.set("oppPriority", f.opportunityPriority);
  if (f.opportunitySource) p.set("oppSource", f.opportunitySource);
  if (f.auditScoreMax != null) p.set("auditMax", String(f.auditScoreMax));
  if (f.incompleteOnly) p.set("incomplete", "1");
  const s = p.toString();
  return s ? `?${s}` : "";
}
