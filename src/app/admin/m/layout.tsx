import Link from "next/link";
import { Monitor } from "lucide-react";
import { requireAdminArea } from "@/lib/admin-session";
import { countUnreadNotifications } from "@/lib/user-notifications";
import { MobileTabBar } from "./mobile-tab-bar";

/**
 * Shell mobile: NON e' una copia ridotta delle 127 pagine admin, e' la
 * superficie dei 4 gesti che si fanno col telefono in mano (registrare al
 * banco, vedere chi e' entrato, cercare un cliente mentre ci parli, sapere chi
 * chiamare). Tutto il resto resta sul desktop, di proposito.
 *
 * L'intestazione desktop e' nascosta da AdminDesktopChrome nel layout padre.
 */
export default async function MobileShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminArea();
  const unread = await countUnreadNotifications(session.user.id);

  return (
    <div className="-mt-4">
      <header className="sticky top-0 z-20 -mx-4 mb-4 border-b border-border/80 bg-card/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <Link href="/admin/m" className="text-base font-semibold tracking-tight">
            Onizuka
          </Link>
          <Link
            href="/admin"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Monitor className="h-4 w-4" aria-hidden />
            Versione completa
          </Link>
        </div>
      </header>

      {children}

      <MobileTabBar pendingCount={unread} />
    </div>
  );
}
