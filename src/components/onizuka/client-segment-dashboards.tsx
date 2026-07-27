import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClientSegmentDashboards } from "@/lib/client-segment-dashboards";

const eur = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);

type Metric = { label: string; value: string | number; alert?: boolean };

function SegmentCard({
  title,
  description,
  href,
  ctaLabel,
  metrics,
  footnote,
}: {
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  metrics: Metric[];
  /** Riga di spiegazione sotto i numeri, dove l'etichetta da sola può ingannare. */
  footnote?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className={`mt-1 text-xl font-bold tabular-nums ${m.alert ? "text-destructive" : ""}`}>{m.value}</p>
            </div>
          ))}
        </div>
        {footnote ? <p className="mt-2 text-xs text-muted-foreground">{footnote}</p> : null}
        <Link href={href} className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
          {ctaLabel} →
        </Link>
      </CardContent>
    </Card>
  );
}

/** Due mini-dashboard a colpo d'occhio: clienti negozio (telefonia/utenze) e clienti digitali/AI. */
export function ClientSegmentDashboardsCards({ retail, digital }: ClientSegmentDashboards) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SegmentCard
        title="🏪 Clienti negozio"
        description="Telefonia, utenze e contratti ricorrenti."
        href="/admin/clients?macro=RETAIL_STORE"
        ctaLabel="Apri clienti negozio"
        metrics={[
          { label: "Clienti", value: retail.clients },
          { label: "Contratti attivi", value: retail.contracts },
          // NON è ricavo: è la somma dei canoni che i clienti pagano al gestore.
          // Chiamarlo "MRR" faceva sembrare un fatturato ricorrente che non esiste.
          { label: "Spesa gestita dei clienti", value: `${eur(retail.mrr)}/mese` },
          { label: "🔔 Cambi proponibili", value: retail.switchDue, alert: retail.switchDue > 0 },
        ]}
        footnote="La spesa gestita è quanto i clienti pagano ogni mese ai gestori sui contratti che segui: è la base su cui lavorare, non un tuo ricavo."
      />
      <SegmentCard
        title="💻 Clienti digitali"
        description="Web, SEO, social, AI e servizi digitali."
        href="/admin/clients?macro=DIGITAL_AI"
        ctaLabel="Apri clienti digitali"
        metrics={[
          { label: "Clienti", value: digital.clients },
          { label: "Servizi attivi", value: digital.services },
          { label: "Audit fatti", value: digital.audits },
          { label: "Lead digitali aperti", value: digital.leads },
        ]}
      />
    </div>
  );
}
