import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { runWithDb } from "@/lib/with-db";
import { TicketUpdateList } from "@/components/tickets/ticket-update-list";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { ClientLink } from "@/components/onizuka/client-link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TicketStatusForm } from "./ticket-status-form";

const statusLabel: Record<string, string> = {
  OPEN: "Aperto",
  IN_PROGRESS: "In lavorazione",
  RESOLVED: "Risolto",
  CLOSED: "Chiuso",
};

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function AdminClientTicketsPage({ searchParams }: Props) {
  await requireAdminArea();

  const clientIdRaw = searchParams.clientId;
  const clientId = typeof clientIdRaw === "string" && clientIdRaw.trim() ? clientIdRaw.trim() : null;

  const filterClient = clientId
    ? await prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, companyName: true },
      })
    : null;

  const loaded = await runWithDb(() =>
    prisma.clientTicket.findMany({
      where: clientId ? { clientId } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        client: { select: { id: true, companyName: true } },
        updates: {
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { attachments: { orderBy: { createdAt: "asc" } } },
        },
        attachments: {
          where: { updateId: null },
          orderBy: { createdAt: "asc" },
        },
      },
    })
  );

  if (!loaded.ok) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ticket clienti</h1>
        </div>
        <DbUnavailableBanner />
      </div>
    );
  }

  const tickets = loaded.data;
  const dateFmt = new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ticket clienti</h1>
        <p className="text-muted-foreground">
          Richieste dal portale cliente.{" "}
          <Link href="/admin/client-portal" className="text-primary hover:underline">
            Portale
          </Link>
        </p>
        {filterClient ? (
          <p className="mt-2 text-sm">
            Filtro: <ClientLink clientId={filterClient.id} name={filterClient.companyName} />
            {" · "}
            <Link href="/admin/client-portal/tickets" className="text-primary hover:underline">
              Tutti i ticket
            </Link>
            {" · "}
            <Link href={`/admin/clients/${filterClient.id}`} className="text-primary hover:underline">
              Scheda 360°
            </Link>
          </p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{filterClient ? `Ticket · ${filterClient.companyName}` : "Ultimi ticket"}</CardTitle>
          <CardDescription>Risposta con nota, allegati e conferma lettura per messaggio.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {tickets.length === 0 ? (
            <p className="text-muted-foreground">Nessun ticket. I clienti possono aprirne da /app/tickets.</p>
          ) : (
            tickets.map((t) => (
              <div key={t.id} className="rounded-md border border-border/60 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      <ClientLink clientId={t.client.id} name={t.client.companyName} className="font-normal" />
                      {" · "}
                      {statusLabel[t.status] ?? t.status} · {dateFmt.format(t.updatedAt)}
                    </p>
                  </div>
                  <TicketStatusForm ticketId={t.id} current={t.status} />
                </div>
                <TicketUpdateList updates={t.updates} dateFmt={dateFmt} showReadReceipts />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
