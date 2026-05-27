import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { countUnreadTickets } from "@/lib/ticket-unread";
import { NavLiveUpdates } from "@/components/onizuka/nav-live-updates";
import { countUnreadNotifications } from "@/lib/user-notifications";
import { getClientPreviewContext } from "@/lib/client-impersonation";
import { isAdminAreaRole } from "@/lib/auth-roles";
import { ClientPreviewBanner } from "@/components/admin/client-preview-banner";
import { ClientBrandMark } from "@/components/onizuka/client-brand-mark";
import { ClientPortalNav, type ClientNavItem } from "@/components/onizuka/client-portal-nav";

function ClientNavFallback() {
  return <div className="h-9 w-full max-w-xl animate-pulse rounded-md bg-muted/40" aria-hidden />;
}

export default async function ClientAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const preview =
    isAdminAreaRole(session.user.role) ? await getClientPreviewContext() : null;
  const isPreview =
    preview != null && preview.adminUserId === session.user.id && isAdminAreaRole(session.user.role);

  let clientId: string | null = null;
  if (session.user.role === "CLIENT") {
    clientId = session.user.clientId;
  } else if (isPreview) {
    clientId = preview.clientId;
  } else {
    redirect("/admin");
  }

  if (!clientId) redirect("/login");

  const client = await prisma.client.findFirst({
    where: { id: clientId },
    select: { companyName: true },
  });

  const [ticketsForUnread, notificationUnread] = await Promise.all([
    prisma.clientTicket.findMany({
      where: { clientId },
      select: {
        updates: { select: { createdByUserId: true, clientReadAt: true } },
      },
    }),
    isPreview ? Promise.resolve(0) : countUnreadNotifications(session.user.id),
  ]);
  const ticketUnread = countUnreadTickets(ticketsForUnread);

  const navPrimary: ClientNavItem[] = [
    { href: "/app/dashboard", label: "Dashboard" },
    { href: "/app", label: "Contenuti" },
    { href: "/app/upload", label: "Invia creatività" },
    {
      href: "/app/tickets",
      label: "Supporto",
      badge: ticketUnread > 0 ? ticketUnread : undefined,
    },
  ];

  const navMore: ClientNavItem[] = [
    { href: "/app/plan", label: "Piano editoriale" },
    { href: "/app/social", label: "Social Pro" },
    { href: "/app/invoices", label: "Fatture" },
    { href: "/app/projects", label: "Progetti" },
    { href: "/app/gallery", label: "Galleria" },
    { href: "/app?status=PENDING", label: "In attesa" },
    ...(isPreview
      ? []
      : [
          {
            href: "/app/notifications",
            label: "Notifiche",
            badge: notificationUnread > 0 ? notificationUnread : undefined,
          },
        ]),
  ];

  return (
    <div className="min-h-screen onizuka-shell-bg">
      <NavLiveUpdates />
      {isPreview && client ? <ClientPreviewBanner companyName={client.companyName} /> : null}
      <header className="sticky top-0 z-20 border-b border-border/80 bg-card/90 shadow-sm shadow-black/5 backdrop-blur-md supports-[backdrop-filter]:bg-card/75">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <ClientBrandMark companyName={client?.companyName} />
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {ticketUnread + notificationUnread > 0 ? (
                <span className="text-xs text-muted-foreground" title="Ticket + notifiche">
                  {ticketUnread + notificationUnread} da leggere
                </span>
              ) : null}
              <span className="max-w-[180px] truncate text-xs text-muted-foreground sm:text-sm">
                {session.user.email}
              </span>
              {!isPreview ? (
                <Link
                  href="/app/account/password"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Password
                </Link>
              ) : (
                <Link href="/admin/clients" className="text-xs text-primary hover:underline">
                  Admin
                </Link>
              )}
              <Button asChild variant="ghost" size="sm" className="h-8 text-muted-foreground">
                <Link href="/api/auth/signout">Esci</Link>
              </Button>
            </div>
          </div>
          <div className="border-t border-border/60 pt-2">
            <Suspense fallback={<ClientNavFallback />}>
              <ClientPortalNav primary={navPrimary} more={navMore} />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
