"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Schede della scheda cliente: organizza in tab le sezioni (prima ~28 card in scroll
 * unico). I dati restano caricati server-side; qui si mostra/nasconde solo la vista
 * attiva, per ridurre il carico cognitivo.
 */
const ActiveTabContext = createContext<string>("");

export function ClientSchedaTabs({
  tabs,
  children,
}: {
  tabs: { id: string; label: string }[];
  children: ReactNode;
}) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  return (
    <ActiveTabContext.Provider value={active}>
      <nav className="flex flex-wrap items-center gap-1 border-b pb-2" aria-label="Sezioni scheda cliente">
        {tabs.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              aria-current={isActive ? "page" : undefined}
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
      </nav>
      <div className="pt-4">{children}</div>
    </ActiveTabContext.Provider>
  );
}

export function ClientSchedaPanel({ id, children }: { id: string; children: ReactNode }) {
  const active = useContext(ActiveTabContext);
  return (
    <div hidden={active !== id} className="space-y-6">
      {children}
    </div>
  );
}
