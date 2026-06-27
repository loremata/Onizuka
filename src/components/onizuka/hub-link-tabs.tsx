"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type HubTab = { href: string; label: string };

/**
 * Barra schede generica in modalità "link" (ogni scheda è una pagina): evidenzia
 * quella attiva dal pathname. Unico componente per gli hub Analitiche / Social /
 * Rubrica (prima 3 componenti quasi identici).
 */
export function HubLinkTabs({ label, tabs }: { label: string; tabs: HubTab[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1 border-b pb-2" aria-label={label}>
      <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              active
                ? "bg-primary font-medium text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
