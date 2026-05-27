import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CommercialKpiItem } from "@/lib/commercial-dashboard";

export function CommercialKpiGrid({ items }: { items: CommercialKpiItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((k) => (
        <Link key={k.id} href={k.href} className="block transition-opacity hover:opacity-90">
          <Card className={k.urgent ? "border-amber-500/40 bg-amber-500/5" : undefined}>
            <CardHeader className="pb-1 pt-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">{k.label}</CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <p className="text-xl font-bold tabular-nums">{k.value}</p>
              {k.hint ? <p className="text-[10px] text-muted-foreground">{k.hint}</p> : null}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
