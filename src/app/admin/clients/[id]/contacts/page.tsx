import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AddContactForm } from "./add-contact-form";

export default async function ClientContactsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminArea();

  const { id: clientId } = await params;
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      personRoles: {
        include: { person: { select: { id: true, fullName: true, email: true } } },
      },
    },
  });
  if (!client) notFound();

  const personByEmail = new Map(
    client.personRoles
      .filter((r) => r.person.email)
      .map((r) => [r.person.email!.toLowerCase(), r.person.id])
  );
  const personByName = new Map(
    client.personRoles.map((r) => [r.person.fullName.toLowerCase(), r.person.id])
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/admin/clients/${client.id}`}>← Scheda cliente</Link>
          </Button>
          <div>
            <h1 className="onizuka-page-title">Referenti</h1>
            <p className="text-muted-foreground">{client.companyName}</p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href={`/admin/clients/${client.id}/edit`}>Anagrafica cliente</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contatti commerciali</CardTitle>
          <CardDescription>
            Persone di riferimento lato cliente (distinti dall&apos;account utente portale / contactEmail anagrafica).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {client.contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun referente ancora.</p>
          ) : (
            <ul className="divide-y divide-border/60 text-sm">
              {client.contacts.map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                  <div>
                    <p className="font-medium">
                      {c.name}
                      {c.isPrimary ? (
                        <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-xs text-primary">Principale</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[c.role, c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {(() => {
                      const personId =
                        (c.email && personByEmail.get(c.email.toLowerCase())) ||
                        personByName.get(c.name.toLowerCase());
                      return personId ? (
                        <Button asChild variant="secondary" size="sm">
                          <Link href={`/admin/crm/people/${personId}`}>Persona CRM</Link>
                        </Button>
                      ) : null;
                    })()}
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/clients/${client.id}/contacts/${c.id}/edit`}>Modifica</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <AddContactForm clientId={client.id} />
        </CardContent>
      </Card>
    </div>
  );
}
