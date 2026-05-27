import Link from "next/link";
import { Button } from "@/components/ui/button";

export function NotificationsPagination({
  basePath,
  page,
  total,
  pageSize,
  extraParams,
}: {
  basePath: string;
  page: number;
  total: number;
  pageSize: number;
  extraParams?: Record<string, string>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  function href(nextPage: number) {
    const p = new URLSearchParams(extraParams ?? {});
    if (nextPage > 0) p.set("page", String(nextPage));
    const q = p.toString();
    return q ? `${basePath}?${q}` : basePath;
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>
        {total} notifiche · pagina {page + 1} / {totalPages}
      </span>
      <div className="flex gap-2">
        {page > 0 ? (
          <Button asChild size="sm" variant="outline">
            <Link href={href(page - 1)}>← Precedente</Link>
          </Button>
        ) : null}
        {page + 1 < totalPages ? (
          <Button asChild size="sm" variant="outline">
            <Link href={href(page + 1)}>Successiva →</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
