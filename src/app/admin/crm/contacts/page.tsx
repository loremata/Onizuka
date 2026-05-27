import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { listUnifiedContacts } from "@/lib/unified-contacts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = { searchParams: Record<string, string | string[] | undefined> };

export default async function UnifiedContactsPage({ searchParams }: Props) {
  const session = await requireAdminArea();
  const qRaw = searchParams.q;
  const q = typeof qRaw === "string" ? qRaw.trim() : undefined;
  const rows = await listUnifiedContacts(session.user.id, q);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/crm/leads">← CRM</Link>
        </Button>
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Contatti unificati</h1>
        <p className="text-muted-foreground">Vista unica lead + clienti con hint dedupe email/P.IVA.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ricerca</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap gap-2">
            <input
              name="q"
              type="search"
              defaultValue={q ?? ""}
              placeholder="Nome, email, telefono, P.IVA"
              className="flex h-10 min-w-[240px] flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <Button type="submit">Cerca</Button>
            {q ? (
              <Button asChild type="button" variant="outline">
                <Link href="/admin/crm/contacts">Azzera</Link>
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Elenco</CardTitle>
          <CardDescription>{rows.length} contatti</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="pb-2">Nome</th>
                <th>Tipo</th>
                <th>Email</th>
                <th>Telefono</th>
                <th>P.IVA</th>
                <th>Stato</th>
                <th>Dedupe</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.kind}-${r.id}`} className="border-b border-border/50">
                  <td className="py-2">
                    <Link href={r.href} className="font-medium text-primary hover:underline">
                      {r.displayName}
                    </Link>
                  </td>
                  <td>{r.kind === "client" ? "Cliente" : "Lead"}</td>
                  <td>{r.email ?? "—"}</td>
                  <td>{r.phone ?? "—"}</td>
                  <td>{r.vatOrFiscal ?? "—"}</td>
                  <td>{r.status}</td>
                  <td className={r.duplicateHints.length ? "text-destructive" : "text-muted-foreground"}>
                    {r.duplicateHints.length ? r.duplicateHints.join(", ") : "ok"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
