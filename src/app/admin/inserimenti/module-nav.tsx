"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Barra di navigazione interna del modulo Inserimenti: presente su ogni pagina,
 * così tutta la sezione è raggiungibile da qualsiasi punto (cruscotto, registra,
 * listino, piani, input mensili) — un'unica sezione "Inserimenti" coerente.
 */
const TABS = [
  { href: "/admin/inserimenti", label: "Cruscotto", exact: true },
  { href: "/admin/inserimenti/registra", label: "Registra" },
  { href: "/admin/inserimenti/listino", label: "Listino" },
  { href: "/admin/inserimenti/piano", label: "Piani" },
  { href: "/admin/inserimenti/mese", label: "Input mensili" },
];

export function InserimentiNav() {
  const pathname = usePathname();
  const isActive = (t: (typeof TABS)[number]) =>
    t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + "/");

  return (
    <nav className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1 text-sm">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={
            "rounded-md px-3 py-1.5 transition-colors " +
            (isActive(t) ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:bg-background/60")
          }
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
