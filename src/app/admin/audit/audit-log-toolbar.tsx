import Link from "next/link";
import { Button } from "@/components/ui/button";

export type AuditToolbarFilters = {
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
  actor?: string;
};

export function AuditLogToolbar({
  filters,
  page,
  total,
  pageSize,
}: {
  filters: AuditToolbarFilters;
  page: number;
  total: number;
  pageSize: number;
}) {
  const { action: currentAction, entity, from, to, actor } = filters;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function queryParams(nextPage?: number) {
    const p = new URLSearchParams();
    if (currentAction) p.set("action", currentAction);
    if (entity) p.set("entity", entity);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (actor) p.set("actor", actor);
    if (nextPage !== undefined && nextPage > 0) p.set("page", String(nextPage));
    return p;
  }

  const exportHref = (() => {
    const p = queryParams();
    const q = p.toString();
    return q ? `/api/admin/audit/export?${q}` : "/api/admin/audit/export";
  })();

  function pageHref(nextPage: number) {
    const q = queryParams(nextPage).toString();
    return q ? `/admin/audit?${q}` : "/admin/audit";
  }

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {total} eventi · pagina {page + 1} / {totalPages}
          {entity ? ` · entità: ${entity}` : ""}
        </span>
        <div className="flex flex-wrap gap-2">
          {page > 0 ? (
            <Button asChild size="sm" variant="outline">
              <Link href={pageHref(page - 1)}>← Precedente</Link>
            </Button>
          ) : null}
          {page + 1 < totalPages ? (
            <Button asChild size="sm" variant="outline">
              <Link href={pageHref(page + 1)}>Successiva →</Link>
            </Button>
          ) : null}
          <Button asChild size="sm" variant="secondary">
            <a href={exportHref} download>
              Esporta CSV
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
