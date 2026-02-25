import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <nav className="flex items-center gap-6">
            <Link href="/admin" className="font-semibold">
              Admin
            </Link>
            <Link href="/admin/clients" className="text-sm text-muted-foreground hover:text-foreground">
              Clients
            </Link>
            <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-foreground">
              Users
            </Link>
            <Link href="/admin/posts" className="text-sm text-muted-foreground hover:text-foreground">
              Posts
            </Link>
            <Link href="/admin/webhooks" className="text-sm text-muted-foreground hover:text-foreground">
              Webhooks
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{session.user.email}</span>
            <Button asChild variant="ghost" size="sm">
              <Link href="/api/auth/signout">Sign out</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
