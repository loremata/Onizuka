import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { runWithDb } from "@/lib/with-db";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function AdminClientPortalPage() {
  const session = await requireAdminArea();

  const result = await runWithDb(() =>
    prisma.client.findMany({
      orderBy: { companyName: "asc" },
      select: {
        id: true,
        companyName: true,
        slug: true,
        contactEmail: true,
        users: {
          where: { role: "CLIENT" },
          select: { id: true, email: true, name: true },
        },
        _count: { select: { posts: true } },
      },
    })
  );

  if (!result.ok) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Client Portal</h1>
          <p className="text-muted-foreground">Gestione accessi clienti e anteprima portale.</p>
        </div>
        <DbUnavailableBanner />
      </div>
    );
  }

  const clients = result.data;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Client Portal</h1>
          <p className="text-muted-foreground">
            Utenti cliente, post assegnati e link al portale approvazioni{" "}
            <code className="rounded bg-muted px-1 text-xs">/app</code>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/client-portal/tickets">Ticket clienti</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/app" target="_blank" rel="noreferrer">
              Apri portale (nuova scheda)
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clienti con accesso</CardTitle>
          <CardDescription>
            Ogni riga mostra account CLIENT collegati. Login demo:{" "}
            <span className="font-mono">client@democlient.com</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {clients.length === 0 ? (
            <p className="text-muted-foreground">Nessun cliente in anagrafica.</p>
          ) : (
            <ul className="space-y-4">
              {clients.map((c) => (
                <li key={c.id} className="rounded-md border border-border/60 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link className="font-medium text-primary hover:underline" href={`/admin/clients/${c.id}`}>
                      {c.companyName}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {c._count.posts} post · slug {c.slug}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{c.contactEmail}</p>
                  {c.users.length === 0 ? (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">Nessun utente CLIENT.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-xs">
                      {c.users.map((u) => (
                        <li key={u.id}>
                          <span className="font-mono">{u.email}</span>
                          {u.name ? <span className="text-muted-foreground"> · {u.name}</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
