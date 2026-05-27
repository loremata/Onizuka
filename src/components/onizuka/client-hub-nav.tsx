import Link from "next/link";
import type { Client360NavItem } from "@/lib/client-360-nav";
import { cn } from "@/lib/utils";

type Props = {
  items: Client360NavItem[];
  className?: string;
};

/** Barra navigazione moduli collegati al cliente (scheda 360°). */
export function ClientHubNav({ items, className }: Props) {
  return (
    <nav
      className={cn(
        "flex flex-wrap gap-2 rounded-lg border border-border/80 bg-card/50 p-2",
        className
      )}
      aria-label="Collegamenti cliente"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted/60"
        >
          {item.label}
          {item.count != null && item.count > 0 ? (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {item.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
