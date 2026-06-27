"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Schede della scheda cliente. La scheda attiva vive in URL (?tab=) → sopravvive a
 * reload e deep-link (prima era in useState e si perdeva). ARIA tabs vere
 * (role tablist/tab/tabpanel) per screen reader. I dati restano caricati
 * server-side; qui si mostra/nasconde solo la vista attiva.
 */
const ActiveTabContext = createContext<string>("");

export function ClientSchedaTabs({
  tabs,
  children,
}: {
  tabs: { id: string; label: string }[];
  children: ReactNode;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const first = tabs[0]?.id ?? "";
  const requested = params.get("tab");
  const active = tabs.some((t) => t.id === requested) ? (requested as string) : first;

  function select(id: string) {
    const sp = new URLSearchParams(Array.from(params.entries()));
    sp.set("tab", id);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  return (
    <ActiveTabContext.Provider value={active}>
      <div role="tablist" aria-label="Sezioni scheda cliente" className="flex flex-wrap items-center gap-1 border-b pb-2">
        {tabs.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={isActive}
              aria-controls={`panel-${t.id}`}
              onClick={() => select(t.id)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                isActive
                  ? "bg-primary font-medium text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="pt-4">{children}</div>
    </ActiveTabContext.Provider>
  );
}

export function ClientSchedaPanel({ id, children }: { id: string; children: ReactNode }) {
  const active = useContext(ActiveTabContext);
  const isActive = active === id;
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={!isActive} className="space-y-6">
      {children}
    </div>
  );
}
