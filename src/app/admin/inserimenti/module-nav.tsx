"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Barra di navigazione interna del modulo Inserimenti: presente su ogni pagina,
 * così tutta la sezione è raggiungibile da qualsiasi punto (cruscotto, gara,
 * avanzamento ufficiale, registra, listino, piani, input mensili) — un'unica
 * sezione "Inserimenti" coerente.
 */
const TABS = [
  { href: "/admin/inserimenti", label: "Negozio", exact: true },
  { href: "/admin/inserimenti/gara-tim", label: "Gara TIM" },
  { href: "/admin/inserimenti/avanzamento", label: "Avanzamento gara" },
  { href: "/admin/inserimenti/registra", label: "Registra" },
  { href: "/admin/inserimenti/listino", label: "Listino" },
  { href: "/admin/inserimenti/piano", label: "Piani" },
  { href: "/admin/inserimenti/mese", label: "Input mensili" },
];

function InserimentiNavInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Il mese in cui si sta lavorando viaggia con la navigazione: senza questo,
  // da "giugno" bastava cambiare tab per ritrovarsi su luglio senza accorgersene.
  // Il mese corrente non si propaga: è già il default di ogni pagina.
  const mese = searchParams.get("mese");
  const query = mese && /^\d{4}-\d{2}$/.test(mese) ? `?mese=${mese}` : "";

  const isActive = (t: (typeof TABS)[number]) =>
    t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + "/");

  return (
    <nav className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1 text-sm">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href + query}
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

export function InserimentiNav() {
  // `useSearchParams` va sempre dentro un confine Suspense: la barra è usata da
  // 8 pagine e non deve poter far fallire il build di nessuna di loro.
  return (
    <Suspense fallback={<nav className="h-9 rounded-lg border bg-muted/40" aria-hidden />}>
      <InserimentiNavInner />
    </Suspense>
  );
}
