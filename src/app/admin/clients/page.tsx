import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientDeleteButton } from "./client-delete-button";

export default async function AdminClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { companyName: "asc" },
    include: { _count: { select: { users: true, posts: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground">Manage client workspaces.</p>
        </div>
        <Button asChild>
          <Link href="/admin/clients/new">New client</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client list</CardTitle>
          <CardDescription>Create, edit, or remove clients. Deleting a client removes all their posts and webhooks; user accounts are unlinked.</CardDescription>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clients yet. Create one to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium">Company</th>
                    <th className="pb-3 font-medium">Slug</th>
                    <th className="pb-3 font-medium">Contact email</th>
                    <th className="pb-3 font-medium">Users</th>
                    <th className="pb-3 font-medium">Posts</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-3">{c.companyName}</td>
                      <td className="py-3 font-mono text-muted-foreground">{c.slug}</td>
                      <td className="py-3">{c.contactEmail}</td>
                      <td className="py-3">{c._count.users}</td>
                      <td className="py-3">{c._count.posts}</td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/clients/${c.id}/edit`}>Edit</Link>
                          </Button>
                          <ClientDeleteButton clientId={c.id} companyName={c.companyName} />
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
