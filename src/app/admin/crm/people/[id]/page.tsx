import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminArea } from "@/lib/admin-session";
import { loadPersonDetail } from "@/lib/person-crm";
import { AdminPageHeader } from "@/components/onizuka/admin-page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CrmPersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAdminArea();
  const person = await loadPersonDetail(id, session.user.id);
  if (!person) notFound();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title={person.fullName}
        lead="Collegamenti persona ↔ azienda"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/crm/people">← Persone</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Anagrafica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Email:</span> {person.email ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Telefono:</span> {person.phone ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Codice fiscale:</span> {person.fiscalCode ?? "—"}
            </p>
            {person.notes ? (
              <p className="whitespace-pre-wrap text-muted-foreground">{person.notes}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aziende collegate</CardTitle>
            <CardDescription>{person.clientRoles.length} ruoli</CardDescription>
          </CardHeader>
          <CardContent>
            {person.clientRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun collegamento.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {person.clientRoles.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <Link
                        href={`/admin/clients/${r.client.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {r.client.companyName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {r.role ?? "Referente"}
                        {r.isPrimary ? " · primario" : ""}
                        {r.client.kind ? ` · ${r.client.kind}` : ""}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/clients/${r.client.id}/contacts`}>Referenti</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
