import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuditCommercialSummary } from "@/lib/load-audit-commercial-summary";

type Props = {
  summary: AuditCommercialSummary;
  title?: string;
};

export function AuditCommercialSummaryCard({ summary, title = "Audit digitale & CRM" }: Props) {
  const dateFmt = dateTimeFormatIt({ dateStyle: "short" });

  if (!summary.audits.length && !summary.opportunities.length && !summary.tasks.length) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {summary.latestScore != null ? `Ultimo punteggio: ${summary.latestScore}/100` : "Nessun audit completato"}
          {summary.mainCriticality ? ` · ${summary.mainCriticality}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {summary.recommendedServices.length > 0 ? (
          <div>
            <p className="font-medium text-muted-foreground">Servizi consigliati</p>
            <ul className="mt-1 list-inside list-disc">
              {summary.recommendedServices.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {summary.nextStep ? (
          <p>
            <span className="font-medium text-muted-foreground">Prossimo step: </span>
            {summary.nextStep}
          </p>
        ) : null}

        {summary.audits.length > 0 ? (
          <div>
            <p className="font-medium text-muted-foreground">Audit collegati</p>
            <ul className="mt-1 space-y-1">
              {summary.audits.map((a) => (
                <li key={a.id}>
                  <Link href={a.href} className="text-primary hover:underline">
                    {a.overallScore != null ? `${a.overallScore}/100` : "—"} · {dateFmt.format(a.createdAt)}
                  </Link>
                  {a.priorityProblem ? ` — ${a.priorityProblem}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {summary.opportunities.length > 0 ? (
          <div>
            <p className="font-medium text-muted-foreground">Opportunity da audit</p>
            <ul className="mt-1 space-y-1">
              {summary.opportunities.map((o) => (
                <li key={o.id}>
                  <Link href={o.href} className="text-primary hover:underline">
                    {o.title}
                  </Link>
                  {` · ${o.status} · ${o.priority}`}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {summary.tasks.length > 0 ? (
          <div>
            <p className="font-medium text-muted-foreground">Task post-audit</p>
            <ul className="mt-1 space-y-1">
              {summary.tasks.map((t) => (
                <li key={t.id}>
                  <Link href={t.href} className="text-primary hover:underline">
                    {t.title}
                  </Link>
                  {t.dueDate ? ` · scad. ${dateFmt.format(t.dueDate)}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
