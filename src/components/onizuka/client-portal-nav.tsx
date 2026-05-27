"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type ClientNavItem = {
  href: string;
  label: string;
  badge?: number;
  /** Confronto path+query (es. /app?status=PENDING) */
  matchSearch?: string;
};

function isActive(pathname: string, search: string, item: ClientNavItem): boolean {
  const [path, query] = item.href.split("?");
  if (query) {
    const params = new URLSearchParams(query);
    const itemSearch = params.toString();
    return pathname === path && (itemSearch === "" || search.includes(itemSearch));
  }
  if (path === "/app") {
    return pathname === "/app" || pathname.startsWith("/app/posts/");
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-1.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NavLink({ item, active }: { item: ClientNavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "shrink-0 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary/15 text-primary ring-1 ring-primary/25"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      {item.label}
      {item.badge ? <NavBadge count={item.badge} /> : null}
    </Link>
  );
}

function MoreMenu({
  items,
  pathname,
  search,
}: {
  items: ClientNavItem[];
  pathname: string;
  search: string;
}) {
  const anyActive = items.some((i) => isActive(pathname, search, i));
  const rootRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") el.removeAttribute("open");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <details ref={rootRef} className="relative shrink-0">
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors [&::-webkit-details-marker]:hidden",
          anyActive
            ? "bg-primary/15 text-primary ring-1 ring-primary/25"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        )}
      >
        Altro
        <span className="text-[10px] opacity-60" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-lg border border-border/80 bg-card py-1 shadow-lg shadow-black/20 sm:left-0 sm:right-auto">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center justify-between px-3 py-1.5 text-sm transition-colors",
              isActive(pathname, search, item)
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            {item.label}
            {item.badge ? <NavBadge count={item.badge} /> : null}
          </Link>
        ))}
      </div>
    </details>
  );
}

type Props = {
  primary: ClientNavItem[];
  more: ClientNavItem[];
};

export function ClientPortalNav({ primary, more }: Props) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label="Portale cliente">
      {primary.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(pathname, search, item)} />
      ))}
      {more.length > 0 ? <MoreMenu items={more} pathname={pathname} search={search} /> : null}
    </nav>
  );
}
