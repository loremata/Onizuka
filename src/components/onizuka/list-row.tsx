import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Riga lista "titolo (link) + sottotitolo + meta a destra", pattern ripetuto in
 * decine di liste (timeline, contratti, opportunità, referenti…).
 * Usare dentro un <ul className="divide-y divide-border/60">.
 */
export function ListRow({
  href,
  title,
  subtitle,
  meta,
}: {
  href?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-2 py-2">
      <div>
        {href ? (
          <Link href={href} className="font-medium text-primary hover:underline">
            {title}
          </Link>
        ) : (
          <span className="font-medium">{title}</span>
        )}
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {meta != null ? <span className="text-xs tabular-nums text-muted-foreground">{meta}</span> : null}
    </li>
  );
}
