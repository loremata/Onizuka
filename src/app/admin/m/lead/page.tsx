import Link from "next/link";
import { Phone, Mail } from "lucide-react";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { leadStatusLabel } from "@/lib/crm-lead-status";
import { loadUserNotificationsPage } from "@/lib/user-notifications";
import { dateTimeFormatIt } from "@/lib/datetime-it";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/**
 * "Chi e' entrato": i contatti nuovi e gli avvisi, con il telefono a portata di
 * pollice. Lo scopo e' chiamare, non gestire la pipeline — per quello c'e' il
 * CRM completo sul desktop.
 */
export default async function MobileLeadPage() {
  const session = await requireAdminArea();

  const [leads, notifications] = await Promise.all([
    prisma.lead.findMany({
      where: {
        ownerUserId: session.user.id,
        status: { notIn: ["CONVERTED", "LOST"] },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        title: true,
        businessName: true,
        contactName: true,
        phone: true,
        email: true,
        city: true,
        source: true,
        status: true,
        createdAt: true,
      },
    }),
    loadUserNotificationsPage(session.user.id, 0, 8),
  ]);

  const dateFmt = dateTimeFormatIt({ dateStyle: "short", timeStyle: "short" });
  const unread = notifications.items.filter((n) => !n.readAt);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold tracking-tight">In arrivo</h1>

      {unread.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Da leggere ({unread.length})
          </h2>
          <ul className="space-y-2">
            {unread.map((n) => (
              <li
                key={n.id}
                className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm"
              >
                <p className="font-medium">{n.title}</p>
                {n.body ? <p className="mt-0.5 text-muted-foreground">{n.body}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">{dateFmt.format(n.createdAt)}</p>
                {n.href ? (
                  <Link
                    href={n.href}
                    className="mt-1.5 inline-block text-xs font-medium text-primary"
                  >
                    Apri →
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Contatti recenti
        </h2>

        {leads.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nessun contatto aperto.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {leads.map((lead) => {
              const name = lead.businessName ?? lead.contactName ?? lead.title;
              return (
                <li key={lead.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {leadStatusLabel[lead.status] ?? lead.status}
                        {lead.city ? ` · ${lead.city}` : ""}
                        {lead.source ? ` · ${lead.source}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {dateFmt.format(lead.createdAt)}
                    </span>
                  </div>

                  {/* Bersagli da 44px: al banco si tocca al volo, spesso con una mano sola. */}
                  <div className="mt-2.5 flex gap-2">
                    {lead.phone ? (
                      <a
                        href={`tel:${lead.phone.replace(/\s/g, "")}`}
                        className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground"
                      >
                        <Phone className="h-4 w-4" aria-hidden />
                        Chiama
                      </a>
                    ) : null}
                    {lead.email ? (
                      <a
                        href={`mailto:${lead.email}`}
                        className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border text-sm font-medium"
                      >
                        <Mail className="h-4 w-4" aria-hidden />
                        Email
                      </a>
                    ) : null}
                    <Link
                      href={`/admin/crm/leads/${lead.id}/edit`}
                      className="flex min-h-11 items-center justify-center rounded-md border px-3 text-sm font-medium"
                    >
                      Scheda
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
