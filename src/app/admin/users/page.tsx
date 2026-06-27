import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildUserSearchWhere, parseUserListFilters } from "@/lib/user-list-filters";
import { StaffPermissionsInline } from "./staff-permissions-inline";
import { ConfirmSubmitButton } from "@/components/onizuka/confirm-submit-button";
import { deleteUser } from "./actions";
import { Select } from "@/components/ui/select";

const roleLabel: Record<string, string> = {
  ADMIN: "Amministratore",
  STAFF: "Staff",
  CLIENT: "Cliente",
};

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function AdminUsersPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  const currentUserId = session?.user?.id;
  const filters = parseUserListFilters(searchParams);

  const users = await prisma.user.findMany({
    where: buildUserSearchWhere(filters),
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      staffAllowedModules: true,
      client: { select: { companyName: true, slug: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="onizuka-page-title">Utenti</h1>
          <p className="text-muted-foreground">Crea utenti cliente e reimposta le password. Filtri opzionali via query GET.</p>
        </div>
        <Button asChild>
          <Link href="/admin/users/new">Nuovo utente</Link>
        </Button>
      </div>

      <Card className="max-w-3xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtri</CardTitle>
          <CardDescription>Ricerca su email, nome e cliente collegato.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex min-w-[200px] flex-1 flex-col gap-1">
              <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
                Testo
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={filters.q}
                placeholder="Email, nome, cliente…"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex min-w-[160px] flex-col gap-1">
              <label htmlFor="role" className="text-xs font-medium text-muted-foreground">
                Ruolo
              </label>
              <Select
                id="role"
                name="role"
                defaultValue={filters.role ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tutti</option>
                <option value="ADMIN">{roleLabel.ADMIN}</option>
                <option value="STAFF">{roleLabel.STAFF}</option>
                <option value="CLIENT">{roleLabel.CLIENT}</option>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Applica</Button>
              <Button asChild type="button" variant="outline">
                <Link href="/admin/users">Azzera</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Elenco utenti</CardTitle>
          <CardDescription>
            Amministratori e utenti cliente. Gli utenti cliente devono essere associati a un cliente.
            {filters.q || filters.role ? ` ${users.length} risultat${users.length === 1 ? "o" : "i"}.` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {filters.q || filters.role
                ? "Nessun utente con questi filtri."
                : "Nessun utente ancora. Creane uno per iniziare."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Nome</th>
                    <th className="pb-3 font-medium">Ruolo</th>
                    <th className="pb-3 font-medium">Cliente</th>
                    <th className="pb-3 font-medium text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-3">{u.email}</td>
                      <td className="py-3 text-muted-foreground">{u.name ?? "—"}</td>
                      <td className="py-3">
                        <span className={u.role === "ADMIN" ? "font-medium" : ""}>{roleLabel[u.role] ?? u.role}</span>
                      </td>
                      <td className="py-3 text-muted-foreground">{u.client ? u.client.companyName : "—"}</td>
                      <td className="py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {u.role === "STAFF" ? (
                            <>
                              <StaffPermissionsInline
                                userId={u.id}
                                initialModules={u.staffAllowedModules ?? []}
                              />
                              <Button asChild variant="secondary" size="sm">
                                <Link href={`/admin/users/${u.id}/staff-permissions`}>Pagina permessi</Link>
                              </Button>
                            </>
                          ) : null}
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/users/${u.id}/reset-password`}>Password</Link>
                          </Button>
                          {u.id !== currentUserId ? (
                            <form action={deleteUser.bind(null, u.id)}>
                              <ConfirmSubmitButton
                                label="Elimina"
                                question={`Eliminare ${u.email}?`}
                              />
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
