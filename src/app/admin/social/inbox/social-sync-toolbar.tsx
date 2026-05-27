"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function SocialSyncToolbar({
  meta,
  linkedin,
  instagram,
}: {
  meta: boolean;
  linkedin: boolean;
  instagram: boolean;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(path: string, label: string) {
    setMsg(null);
    start(async () => {
      const res = await fetch(path, { method: "POST" });
      const data = (await res.json()) as { imported?: number; skipped?: number; upserted?: number; error?: string };
      if (!res.ok) {
        setMsg(`${label}: ${data.error ?? "errore"}`);
        return;
      }
      const n = data.imported ?? data.upserted ?? 0;
      const sk = data.skipped ?? 0;
      setMsg(`${label}: +${n}, saltati ${sk}. Ricarica la pagina.`);
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {meta ? (
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run("/api/admin/social/sync-meta", "Meta")}>
          Sync Meta
        </Button>
      ) : null}
      {linkedin ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run("/api/admin/social/sync-linkedin", "LinkedIn")}
        >
          Sync LinkedIn
        </Button>
      ) : null}
      {instagram ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run("/api/admin/social/sync-instagram", "Instagram")}
        >
          Sync Instagram
        </Button>
      ) : null}
      {!meta && !linkedin && !instagram ? (
        <p className="text-xs text-muted-foreground">Configura token Meta / LinkedIn / Instagram in .env</p>
      ) : null}
      {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
    </div>
  );
}
