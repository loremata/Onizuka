import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAppClientContext } from "@/lib/app-client-session";
import { prisma } from "@/lib/prisma";
import { countUnreadTickets, countUnreadAdminReplies, isTicketUnread } from "@/lib/ticket-unread";
import { TicketMarkReadButton } from "./ticket-mark-read-button";
import { TicketUpdateList } from "@/components/tickets/ticket-update-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TicketForm } from "./ticket-form";
import { TicketsMarkRead } from "./tickets-mark-read";

const statusLabel: Record<string, string> = {
  OPEN: "Aperto",
  IN_PROGRESS: "In lavorazione",
  RESOLVED: "Risolto",
  CLOSED: "Chiuso",
};

export default async function ClientTicketsPage() {
  const ctx = await requireAppClientContext();
  const tickets = await prisma.clientTicket.findMany({
    where: { clientId: ctx.clientId },
    orderBy: { updatedAt: "desc" },
    include: {
      updates: {
        orderBy: { createdAt: "desc" },
        include: { attachments: { orderBy: { createdAt: "asc" } } },
      },
      attachments: {
        where: { updateId: null },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const dateFmt = dateTimeFormatIt({ dateStyle: "short", timeStyle: "short" });
  const unreadCount = countUnreadTickets(tickets);

  return (
    <div className="space-y-6">
      <TicketsMarkRead />
      <div>
        <h1 className="onizuka-page-title">Supporto</h1>
        <p className="text-muted-foreground">
          Apri un ticket per richieste al team.
          {unreadCount > 0 ? (
            <span className="ml-2 rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {unreadCount} con risposte non lette
            </span>
          ) : null}
        </p>
      </div>
      <Link href="/app" className="text-sm text-primary hover:underline">
        ← Torna ai post
      </Link>

      {ctx.isAdminPreview ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-muted-foreground">
          In anteprima admin puoi aprire ticket di test (registrati in audit). Le altre azioni restano limitate.
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nuovo ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <TicketForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">I tuoi ticket</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {tickets.length === 0 ? (
            <p className="text-muted-foreground">Nessun ticket ancora.</p>
          ) : (
            <ul className="space-y-3">
              {tickets.map((t) => {
                const unread = isTicketUnread(t);
                const unreadReplies = countUnreadAdminReplies(t);
                return (
                  <li key={t.id} className="rounded-md border border-border/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{t.title}</p>
                        {unread ? (
                          <span className="rounded bg-amber-500/15 px-1.5 text-xs text-amber-700 dark:text-amber-400">
                            {unreadReplies > 0 ? `${unreadReplies} nuove risposte` : "Nuove risposte"}
                          </span>
                        ) : null}
                      </div>
                      {unread ? <TicketMarkReadButton ticketId={t.id} /> : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {statusLabel[t.status] ?? t.status} · {dateFmt.format(t.updatedAt)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{t.body}</p>
                    {t.attachments.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs">
                        {t.attachments.map((a) => (
                          <li key={a.id}>
                            <a className="text-primary hover:underline" href={a.url} target="_blank" rel="noreferrer">
                              {a.filename}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {t.updates.length > 0 ? (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-foreground">Risposte dal team</p>
                        <TicketUpdateList updates={t.updates} dateFmt={dateFmt} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
