"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Hub Rubrica CRM a schede: contatti, persone e segmenti come un'unica anagrafica. */
const TABS: { href: string; label: string }[] = [
  { href: "/admin/crm/contacts", label: "Contatti" },
  { href: "/admin/crm/people", label: "Persone" },
  { href: "/admin/crm/database", label: "Segmenti & database" },
];

export function CrmDirectoryTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1 border-b pb-2" aria-label="Hub rubrica CRM">
      <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Rubrica
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
