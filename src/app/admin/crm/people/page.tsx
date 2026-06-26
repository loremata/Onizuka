import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { CrmDirectoryTabs } from "@/components/onizuka/crm-directory-tabs";
import { listPeople } from "@/lib/person-crm";
import { AdminPageHeader } from "@/components/onizuka/admin-page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = { searchParams: Record<string, string | string[] | undefined> };

export default async function CrmPeoplePage({ searchParams }: Props) {
  const session = await requireAdminArea();
  const qRaw = searchParams.q;
  const q = typeof qRaw === "string" ? qRaw.trim() : undefined;
  const rows = await listPeople(session.user.id, q);

  return (
    <div className="space-y-8">
      <CrmDirectoryTabs />
      <AdminPageHeader
        title="Persone"
        lead="Entità persona fisica collegata a una o più aziende (ruoli su scheda cliente)."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/crm/contacts">Contatti unificati</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ricerca</CardTitle>
          <CardDescription>
            I referenti creati su scheda cliente vengono sincronizzati qui automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap gap-2">
            <input
              name="q"
              type="search"
              defaultValue={q ?? ""}
              placeholder="Nome, email, azienda"
              className="flex h-10 min-w-[240px] flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <Button type="submit">Cerca</Button>
            {q ? (
              <Button asChild type="button" variant="outline">
                <Link href="/admin/crm/people">Azzera</Link>
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Elenco</CardTitle>
          <CardDescription>{rows.length} persone</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessuna persona. Aggiungi un referente da{" "}
              <Link href="/admin/clients" className="text-primary hover:underline">
                scheda cliente → Referenti
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <Link
                      href={`/admin/crm/people/${p.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {p.fullName}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {p.email ?? "—"}
                      {p.primaryCompany ? ` · ${p.primaryCompany}` : ""}
                      {p.companyCount > 1 ? ` (+${p.companyCount - 1} aziende)` : ""}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/crm/people/${p.id}`}>Scheda</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
