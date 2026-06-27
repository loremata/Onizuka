import { Suspense } from "react";
import Link from "next/link";
import { Toaster } from "sonner";
import { FlashToast } from "@/components/onizuka/flash-toast";
import { requireAdminArea } from "@/lib/admin-session";
import { Button } from "@/components/ui/button";
import { GlobalCommandBar } from "@/components/onizuka/global-command-bar";
import { MarketingSiteLink } from "@/components/onizuka/marketing-site-link";
import { NavLiveUpdates } from "@/components/onizuka/nav-live-updates";
import { AdminBrandMark } from "@/components/onizuka/admin-brand-mark";
import { AdminPrimaryNav } from "@/components/onizuka/admin-nav-links";
import { AdminToolsMenu } from "@/components/onizuka/admin-tools-menu";
import { ADMIN_TOOL_NAV_GROUPS } from "@/lib/admin-tool-nav-groups";
import { countUnreadNotifications } from "@/lib/user-notifications";
import { countApprovalQueuePending } from "@/lib/approval-queue";

function CommandBarFallback() {
  return (
    <div className="border-b border-border/80 bg-card/40">
      <div className="container mx-auto h-11 animate-pulse px-4" aria-hidden />
    </div>
  );
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminArea();

  const [notificationUnread, approvalPending] = await Promise.all([
    countUnreadNotifications(session.user.id),
    countApprovalQueuePending(session.user.id),
  ]);

  // Barra principale = solo i driver quotidiani. Tutto il resto è nelle aree di lavoro
  // (dropdown "Strumenti") — vedi ADMIN_TOOL_NAV_GROUPS. Riorganizzazione 27/06/2026.
  const navPrimary = [
    { href: "/admin", label: "Oggi" },
    { href: "/admin/approvals", label: "Approvazioni", badge: approvalPending },
    { href: "/admin/clients", label: "Clienti" },
  ];

  const toolGroups = ADMIN_TOOL_NAV_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.items.map((item) =>
      item.href === "/admin/notifications" && notificationUnread > 0
        ? { ...item, badge: notificationUnread }
        : item
    ),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen onizuka-shell-bg">
      <NavLiveUpdates />
      <div className="sticky top-0 z-20 border-b border-border/80 bg-card/90 shadow-sm shadow-black/5 backdrop-blur-md supports-[backdrop-filter]:bg-card/75">
        <header className="container mx-auto px-4">
          <div className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <AdminBrandMark />
              <MarketingSiteLink />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden max-w-[220px] truncate text-xs text-muted-foreground sm:inline sm:text-sm">
                {session.user.email}
              </span>
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                <Link href="/api/auth/signout">Esci</Link>
              </Button>
            </div>
          </div>
          <div className="border-t border-border/60 py-2">
            <AdminPrimaryNav items={navPrimary} />
          </div>
          <div className="border-t border-border/40 pb-2 pt-1.5">
            <AdminToolsMenu groups={toolGroups} />
          </div>
        </header>
        <Suspense fallback={<CommandBarFallback />}>
          <GlobalCommandBar />
        </Suspense>
      </div>
      <main className="container mx-auto px-4 py-8">{children}</main>
      <Toaster richColors position="top-right" closeButton />
      <Suspense fallback={null}>
        <FlashToast />
      </Suspense>
    </div>
  );
}
