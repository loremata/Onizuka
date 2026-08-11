"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlusCircle, Inbox, Search, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/m/registra", label: "Registra", Icon: PlusCircle },
  { href: "/admin/m/lead", label: "In arrivo", Icon: Inbox },
  { href: "/admin/m/cerca", label: "Cerca", Icon: Search },
  { href: "/admin/m/mosse", label: "Mosse", Icon: Target },
] as const;

/**
 * Barra fissa in fondo: e' la zona che il pollice raggiunge senza spostare la
 * presa. `pb-[env(safe-area-inset-bottom)]` tiene le voci sopra la barra gesti
 * di iPhone, che altrimenti coprirebbe meta' dei tocchi.
 */
export function MobileTabBar({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Navigazione rapida"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                // min-h-14: bersaglio comodo al pollice, sopra i 44px consigliati.
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
                {href === "/admin/m/lead" && pendingCount > 0 ? (
                  <span className="absolute right-[22%] top-1.5 min-w-4 rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
                    {pendingCount > 9 ? "9+" : pendingCount}
                  </span>
                ) : null}
                {active ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
