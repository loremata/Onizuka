"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Aggiorna badge notifiche: SSE quando supportato, altrimenti poll sul conteggio.
 */
export function NavLiveUpdates({
  pollMs = 45_000,
  refreshMs = 180_000,
  useSse = true,
}: {
  pollMs?: number;
  refreshMs?: number;
  useSse?: boolean;
}) {
  const router = useRouter();
  const lastCount = useRef<number | null>(null);
  const lastRev = useRef<number | null>(null);

  useEffect(() => {
    function onUpdate(count: number, rev: number) {
      const changed =
        (lastCount.current !== null && lastCount.current !== count) ||
        (lastRev.current !== null && lastRev.current !== rev);
      if (changed) router.refresh();
      lastCount.current = count;
      lastRev.current = rev;
    }

    async function pollUnread() {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/notifications/unread-count", { cache: "no-store" });
        if (!res.ok) return;
        const { count, rev } = (await res.json()) as { count: number; rev?: number };
        onUpdate(count, rev ?? 0);
      } catch {
        /* ignore */
      }
    }

    let es: EventSource | null = null;
    let reconnectTimer: number | undefined;

    function connectSse() {
      if (!useSse || typeof EventSource === "undefined") return;
      es = new EventSource("/api/notifications/stream");
      es.onmessage = (ev) => {
        try {
          const { count, rev } = JSON.parse(ev.data) as { count: number; rev?: number };
          if (typeof count === "number") onUpdate(count, rev ?? 0);
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        es?.close();
        es = null;
        reconnectTimer = window.setTimeout(connectSse, 8_000);
      };
    }

    connectSse();
    void pollUnread();

    const pollId = window.setInterval(pollUnread, pollMs);
    const refreshId = window.setInterval(() => {
      if (document.visibilityState !== "hidden") router.refresh();
    }, refreshMs);

    const onVisible = () => {
      void pollUnread();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      es?.close();
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      window.clearInterval(pollId);
      window.clearInterval(refreshId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, pollMs, refreshMs, useSse]);

  return null;
}
