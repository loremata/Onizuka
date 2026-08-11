"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { searchClientsForCounter } from "../../inserimenti/actions";

type Hit = { id: string; companyName: string; phone: string | null; isLead: boolean };

/**
 * Stessa ricerca del banco (searchClientsForCounter), con la pausa di 300ms:
 * mentre parli al cliente si digita a pezzi, e interrogare a ogni tasto e'
 * solo rumore. `text-base` non e' un vezzo: sotto i 16px iOS zooma da solo
 * sul campo a fuoco e ti sposta la pagina.
 */
export function MobileClientSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const h = setTimeout(async () => {
      const res = await searchClientsForCounter(term).catch(() => []);
      setHits(res);
      setSearching(false);
    }, 300);
    return () => clearTimeout(h);
  }, [q]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          autoComplete="off"
          placeholder="Nome o telefono…"
          aria-label="Cerca cliente"
          className="min-h-12 w-full rounded-lg border bg-background pl-9 pr-3 text-base"
        />
      </div>

      {q.trim().length >= 2 && hits.length === 0 && !searching ? (
        <p className="px-1 text-sm text-muted-foreground">Nessun cliente trovato.</p>
      ) : null}

      <ul className="space-y-2">
        {hits.map((hit) => (
          <li key={hit.id}>
            <button
              type="button"
              onClick={() => router.push(`/admin/m/cerca/${hit.id}`)}
              className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-left"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{hit.companyName}</span>
                {hit.phone ? (
                  <span className="block truncate text-xs text-muted-foreground">{hit.phone}</span>
                ) : null}
              </span>
              {hit.isLead ? (
                <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-800 dark:text-amber-300">
                  prospect
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
