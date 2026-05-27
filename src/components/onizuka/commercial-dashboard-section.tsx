import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CommercialActionRow } from "@/lib/commercial-dashboard";

type Props = {
  title: string;
  description?: string;
  rows: CommercialActionRow[];
  emptyLabel?: string;
};

export function CommercialDashboardSection({
  title,
  description,
  rows,
  emptyLabel = "Nessuna azione in coda.",
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {rows.length === 0 ? (
          <p className="text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border/60 p-2"
              >
                <div className="min-w-0">
                  <p className="font-medium">{r.title}</p>
                  {r.subtitle ? (
                    <p className="text-xs text-muted-foreground">{r.subtitle}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  <Button asChild variant="outline" size="sm">
                    <Link href={r.href}>{r.actionLabel}</Link>
                  </Button>
                  {r.secondaryHref && r.secondaryActionLabel ? (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={r.secondaryHref}>{r.secondaryActionLabel}</Link>
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
