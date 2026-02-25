import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage clients, users, and content approvals.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">—</p>
            <p className="text-xs text-muted-foreground">Total clients</p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href="/admin/clients">Manage clients</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">—</p>
            <p className="text-xs text-muted-foreground">Posts awaiting approval</p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href="/admin/posts?status=PENDING">View posts</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">—</p>
            <p className="text-xs text-muted-foreground">Approved posts</p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href="/admin/posts?status=APPROVED">View posts</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
          <CardDescription>Step 2 will add CRUD for clients and users; Step 3 will add post creation.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button asChild>
            <Link href="/admin/clients">Clients</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/users">Users</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/posts">Posts</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
