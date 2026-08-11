import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone, Mail } from "lucide-react";
import { requireFullAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { dateTimeFormatIt } from "@/lib/datetime-it";

export const dynamic = "force-dynamic";

/**
 * Scheda essenziale: le cose che servono MENTRE ci parli, non l'anagrafica
 * completa. Cioe' come chiamarlo, cosa ha gia' attivo con noi, cosa scade e
 * cosa ha comprato in negozio. Il resto e' un tocco piu' in la', sul desktop.
 */
export default async function MobileClientCardPage({
  params,
}: {
  params: { id: string };
}) {
  await requireFullAdmin();

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      companyName: true,
      phone: true,
      contactEmail: true,
      city: true,
      address: true,
      tags: true,
      relationshipState: true,
      notes: true,
      commercialServices: {
        where: { active: true },
        select: { commercialService: { select: { name: true } } },
      },
      retailContracts: {
        where: { status: "ACTIVE" },
        orderBy: { renewalDate: "asc" },
        select: {
          id: true,
          label: true,
          operator: true,
          monthlyEur: true,
          renewalDate: true,
        },
      },
      storeSales: {
        orderBy: { date: "desc" },
        take: 5,
        select: { id: true, date: true, brand: true, lineKey: true },
      },
    },
  });

  if (!client) notFound();

  const dateFmt = dateTimeFormatIt({ dateStyle: "medium" });
  const phone = client.phone?.replace(/\s/g, "");

  return (
    <div className="space-y-5">
      <Link
        href="/admin/m/cerca"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Cerca
      </Link>

      <div>
        <h1 className="text-xl font-semibold tracking-tight">{client.companyName}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {client.relationshipState}
          {client.city ? ` · ${client.city}` : ""}
        </p>
      </div>

      {phone || client.contactEmail ? (
        <div className="flex gap-2">
          {phone ? (
            <a
              href={`tel:${phone}`}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground"
            >
              <Phone className="h-4 w-4" aria-hidden />
              Chiama
            </a>
          ) : null}
          {client.contactEmail ? (
            <a
              href={`mailto:${client.contactEmail}`}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg border text-sm font-medium"
            >
              <Mail className="h-4 w-4" aria-hidden />
              Email
            </a>
          ) : null}
        </div>
      ) : null}

      <Section title="Attivo con noi">
        {client.commercialServices.length === 0 ? (
          <Empty>Nessun servizio attivo.</Empty>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {client.commercialServices.map((s, i) => (
              <span key={i} className="rounded-full border bg-card px-2.5 py-1 text-xs">
                {s.commercialService.name}
              </span>
            ))}
          </div>
        )}
      </Section>

      <Section title="Contratti e scadenze">
        {client.retailContracts.length === 0 ? (
          <Empty>Nessun contratto attivo.</Empty>
        ) : (
          <ul className="space-y-2">
            {client.retailContracts.map((c) => (
              <li key={c.id} className="rounded-lg border bg-card p-3 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{c.label}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    € {Number(c.monthlyEur).toLocaleString("it-IT", { minimumFractionDigits: 2 })}/mese
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {c.operator ?? "—"}
                  {c.renewalDate ? ` · rinnovo ${dateFmt.format(c.renewalDate)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Ultimi acquisti in negozio">
        {client.storeSales.length === 0 ? (
          <Empty>Nessuna vendita agganciata.</Empty>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {client.storeSales.map((s) => (
              <li key={s.id} className="flex justify-between gap-3">
                <span className="truncate">
                  {s.brand} · {s.lineKey}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {dateFmt.format(s.date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {client.notes ? (
        <Section title="Note">
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{client.notes}</p>
        </Section>
      ) : null}

      <Link
        href={`/admin/clients/${client.id}`}
        className="flex min-h-12 items-center justify-center rounded-lg border text-sm font-medium"
      >
        Scheda completa
      </Link>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
