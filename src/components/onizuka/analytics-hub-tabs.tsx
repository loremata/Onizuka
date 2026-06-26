"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Barra schede dell'hub Analitiche: unifica le dashboard analitiche (prima sparse
 * in voci di menu separate) in un unico strumento navigabile. Ogni scheda resta la
 * sua pagina (nessuna funzionalità persa), ma si naviga come un hub coerente.
 */
const TABS: { href: string; label: string }[] = [
  { href: "/admin/insights", label: "Panoramica" },
  { href: "/admin/insights/forecast", label: "Forecast" },
  { href: "/admin/insights/revenue-at-risk", label: "Revenue at risk" },
  { href: "/admin/crm/commercial", label: "Commerciale" },
  { href: "/admin/crm/health-radar", label: "Salute portafoglio" },
  { href: "/admin/intelligence", label: "NBA / AI" },
  { href: "/admin/economics", label: "Economics" },
  { href: "/admin/regia-operativa", label: "Regia operativa" },
];

export function AnalyticsHubTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1 border-b pb-2" aria-label="Hub analitiche">
      <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Analitiche
      </span>
      {TABS.map((t) => {
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
