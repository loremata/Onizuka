import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  filtersToSearchParams,
  type CommercialDashboardFilters,
} from "@/lib/commercial-dashboard-filters";

const PERIODS = [
  { value: "7", label: "7 giorni" },
  { value: "30", label: "30 giorni" },
  { value: "90", label: "90 giorni" },
  { value: "all", label: "Tutto" },
] as const;

const LEAD_STATUSES = [
  { value: "", label: "Tutti lead" },
  { value: "NEW", label: "NEW" },
  { value: "QUALIFIED", label: "QUALIFIED" },
  { value: "CONTACTED", label: "CONTACTED" },
  { value: "COLD", label: "COLD" },
] as const;

const OPP_PRIORITIES = [
  { value: "", label: "Tutte priorità" },
  { value: "HIGH", label: "Alta" },
  { value: "MEDIUM", label: "Media" },
  { value: "LOW", label: "Bassa" },
] as const;

const OPP_SOURCES = [
  { value: "", label: "Tutte fonti" },
  { value: "DIGITAL_AUDIT", label: "Audit digitale" },
] as const;

const AUDIT_SCORE_MAX = [
  { value: "", label: "Tutti score" },
  { value: "45", label: "≤ 45 (critico)" },
  { value: "60", label: "≤ 60" },
] as const;

type Props = {
  filters: CommercialDashboardFilters;
};

export function CommercialDashboardFiltersBar({ filters }: Props) {
  const base = "/admin/crm/commercial";

  const linkFor = (patch: Partial<CommercialDashboardFilters>) =>
    `${base}${filtersToSearchParams({ ...filters, ...patch })}`;

  return (
    <div className="space-y-3 rounded-lg border border-border/60 p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Periodo audit:</span>
        {PERIODS.map((p) => (
          <Button
            key={p.value}
            asChild
            variant={filters.period === p.value ? "default" : "outline"}
            size="sm"
          >
            <Link href={linkFor({ period: p.value })}>{p.label}</Link>
          </Button>
        ))}
        <Button
          asChild
          variant={filters.incompleteOnly ? "default" : "outline"}
          size="sm"
          className="ml-1"
        >
          <Link href={linkFor({ incompleteOnly: !filters.incompleteOnly })}>
            {filters.incompleteOnly ? "Solo incompleti ✓" : "Dati incompleti"}
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={base}>Reset</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground w-full sm:w-auto">Filtri CRM:</span>
        {LEAD_STATUSES.map((s) => (
          <Button
            key={`lead-${s.value || "all"}`}
            asChild
            variant={(filters.leadStatus ?? "") === s.value ? "secondary" : "outline"}
            size="sm"
          >
            <Link
              href={linkFor({
                leadStatus: s.value || undefined,
              })}
            >
              {s.label}
            </Link>
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {OPP_PRIORITIES.map((p) => (
          <Button
            key={`opp-p-${p.value || "all"}`}
            asChild
            variant={(filters.opportunityPriority ?? "") === p.value ? "secondary" : "outline"}
            size="sm"
          >
            <Link href={linkFor({ opportunityPriority: p.value || undefined })}>{p.label}</Link>
          </Button>
        ))}
        {OPP_SOURCES.map((s) => (
          <Button
            key={`opp-s-${s.value || "all"}`}
            asChild
            variant={(filters.opportunitySource ?? "") === s.value ? "secondary" : "outline"}
            size="sm"
          >
            <Link href={linkFor({ opportunitySource: s.value || undefined })}>{s.label}</Link>
          </Button>
        ))}
        {AUDIT_SCORE_MAX.map((a) => (
          <Button
            key={`audit-${a.value || "all"}`}
            asChild
            variant={
              String(filters.auditScoreMax ?? "") === a.value ? "secondary" : "outline"
            }
            size="sm"
          >
            <Link
              href={linkFor({
                auditScoreMax: a.value ? Number(a.value) : undefined,
              })}
            >
              {a.label}
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
