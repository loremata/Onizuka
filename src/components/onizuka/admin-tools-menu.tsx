"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { AdminNavItem } from "@/components/onizuka/admin-nav-links";

export type AdminToolGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupHasActive(pathname: string, items: AdminNavItem[]): boolean {
  return items.some((item) => isActive(pathname, item.href));
}

export function AdminToolsMenu({ groups }: { groups: AdminToolGroup[] }) {
  const pathname = usePathname() ?? "";
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const closeAll = () => {
      root.querySelectorAll("details[open]").forEach((el) => el.removeAttribute("open"));
    };
    const onClick = (e: MouseEvent) => {
      if (!root.contains(e.target as Node)) closeAll();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (groups.length === 0) return null;

  return (
    <div ref={rootRef} className="flex flex-wrap items-center gap-1" role="navigation" aria-label="Strumenti">
      <span className="mr-1 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
        Strumenti
      </span>
      {groups.map((group) => {
        const active = groupHasActive(pathname, group.items);
        return (
          <details
            key={group.id}
            className="relative"
            onToggle={(e) => {
              const el = e.currentTarget;
              if (!el.open) return;
              rootRef.current?.querySelectorAll("details[open]").forEach((other) => {
                if (other !== el) other.removeAttribute("open");
              });
            }}
          >
            <summary
              className={cn(
                "flex cursor-pointer list-none items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors [&::-webkit-details-marker]:hidden",
                active
                  ? "bg-primary/15 text-primary ring-1 ring-primary/25"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              {group.label}
              <span className="text-[10px] opacity-60" aria-hidden>
                ▾
              </span>
            </summary>
            <div className="absolute left-0 top-full z-50 mt-1 min-w-[11rem] rounded-lg border border-border/80 bg-card py-1 shadow-lg shadow-black/20">
              {group.items.map((item) => {
                const itemActive = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between px-3 py-1.5 text-xs transition-colors",
                      itemActive
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    {item.label}
                    {item.badge && item.badge > 0 ? (
                      <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}
