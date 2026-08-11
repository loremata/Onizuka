"use client";

import { usePathname } from "next/navigation";

/**
 * La shell mobile (/admin/m) ha una sua intestazione e una barra in basso.
 * Sotto quel percorso la chrome desktop va nascosta, altrimenti sul telefono
 * si sommano due navigazioni e il contenuto parte a meta' schermo.
 */
function useIsMobileShell(): boolean {
  const pathname = usePathname() ?? "";
  // Match esatto o su "/admin/m/": un semplice startsWith("/admin/m")
  // prenderebbe anche /admin/memory.
  return pathname === "/admin/m" || pathname.startsWith("/admin/m/");
}

/** Nasconde l'intestazione desktop dentro la shell mobile. */
export function AdminDesktopChrome({ children }: { children: React.ReactNode }) {
  return useIsMobileShell() ? null : <>{children}</>;
}

/**
 * Il contenitore del contenuto. Su mobile niente `container` (che centra su una
 * larghezza da desktop) e spazio in fondo per la barra fissa.
 */
export function AdminMain({ children }: { children: React.ReactNode }) {
  return (
    <main
      className={
        useIsMobileShell()
          ? "mx-auto w-full max-w-2xl px-4 pb-28 pt-4"
          : "container mx-auto px-4 py-8"
      }
    >
      {children}
    </main>
  );
}
