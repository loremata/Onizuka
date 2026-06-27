import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Card KPI "label + valore grande (+ hint/link)", pattern ripetuto nelle dashboard. */
export function KpiBox({
  label,
  value,
  hint,
  href,
  hrefLabel = "Apri",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        {href ? (
          <Link href={href} className="mt-1 inline-block text-xs text-primary hover:underline">
            {hrefLabel}
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
