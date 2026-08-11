import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { loadClientsWithUpsellPotential } from "@/lib/client-commercial-gaps";
import { getDormantClients } from "@/lib/dormant-reactivation";
import { getLeadPipelineBottlenecks } from "@/lib/lead-pipeline-bottleneck";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/**
 * "Chi chiamo adesso": tre fonti CRM, nessun dato di cassa.
 * Di proposito NON usa loadCommandCenterPriorities, che mescola cashflow e
 * scaduti: quelli sono del modulo finance e non devono finire sul telefono di
 * un collaboratore che dal desktop non li vedrebbe.
 */
export default async function MobileMossePage() {
  const session = await requireAdminArea();

  const [upsell, dormant, stalled] = await Promise.all([
    loadClientsWithUpsellPotential(5),
    getDormantClients(session.user.id, 5),
    getLeadPipelineBottlenecks(session.user.id, 5),
  ]);

  const empty = upsell.length === 0 && dormant.length === 0 && stalled.length === 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Prossime mosse</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Chi vale la pena chiamare, e perché.
        </p>
      </div>

      {empty ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Niente in coda: nessun cliente dormiente, nessun lead in stallo.
          </CardContent>
        </Card>
      ) : null}

      {stalled.length > 0 ? (
        <Group title="Lead fermi da troppo">
          {stalled.map((lead) => (
            <Move
              key={lead.leadId}
              href={`/admin/crm/leads/${lead.leadId}/edit`}
              title={lead.businessName ?? lead.title}
              detail={`${lead.statusLabel} da ${lead.agingDays} giorni (attesi ${lead.expectedSlaDays})`}
              flag={lead.priorityScore >= 70 ? "alta" : null}
            />
          ))}
        </Group>
      ) : null}

      {dormant.length > 0 ? (
        <Group title="Clienti da riattivare">
          {dormant.map((c) => (
            <Move
              key={c.clientId}
              href={`/admin/m/cerca/${c.clientId}`}
              title={c.companyName}
              detail={c.reason}
              flag={null}
            />
          ))}
        </Group>
      ) : null}

      {upsell.length > 0 ? (
        <Group title="Hanno spazio per altro">
          {upsell.map((c) => (
            <Move
              key={c.clientId}
              href={`/admin/m/cerca/${c.clientId}`}
              title={c.companyName}
              detail={`${c.missingCount} servizi del catalogo non attivi`}
              flag={null}
            />
          ))}
        </Group>
      ) : null}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

function Move({
  href,
  title,
  detail,
  flag,
}: {
  href: string;
  title: string;
  detail: string;
  flag: string | null;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-14 items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium">{title}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>
        </span>
        {flag ? (
          <span className="shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
            {flag}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
