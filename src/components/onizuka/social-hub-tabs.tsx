"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Hub Social a schede: contenuti, calendario, engagement, inbox come un unico strumento. */
const TABS: { href: string; label: string }[] = [
  { href: "/admin/social", label: "Panoramica" },
  { href: "/admin/posts", label: "Contenuti" },
  { href: "/admin/social/calendar", label: "Calendario" },
  { href: "/admin/social/engagement", label: "Engagement" },
  { href: "/admin/social/inbox", label: "Inbox commenti" },
];

export function SocialHubTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1 border-b pb-2" aria-label="Hub social">
      <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Social
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
