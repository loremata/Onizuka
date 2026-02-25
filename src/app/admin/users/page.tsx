import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    include: { client: { select: { companyName: true, slug: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground">Create client users and reset passwords.</p>
        </div>
        <Button asChild>
          <Link href="/admin/users/new">New user</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User list</CardTitle>
          <CardDescription>Admin and client users. Client users must be assigned to a client.</CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users yet. Create one to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">Client</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-3">{u.email}</td>
                      <td className="py-3 text-muted-foreground">{u.name ?? "—"}</td>
                      <td className="py-3">
                        <span className={u.role === "ADMIN" ? "font-medium" : ""}>{u.role}</span>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {u.client ? u.client.companyName : "—"}
                      </td>
                      <td className="py-3 text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/users/${u.id}/reset-password`}>Reset password</Link>
                        </Button>
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
