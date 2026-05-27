"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type CheckResult = {
  name: string;
  ok: boolean;
  status: number;
  detail?: string;
};

export function GoLiveSmokePanel() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<CheckResult[] | null>(null);

  async function run() {
    setRunning(true);
    setResults(null);
    const checks: { name: string; url: string }[] = [
      { name: "Health liveness", url: "/api/health" },
      { name: "Health readiness (DB)", url: "/api/health/ready" },
      { name: "Walk-in", url: "/walkin" },
      { name: "Status pubblico", url: "/status" },
      { name: "Login", url: "/login" },
      { name: "robots.txt", url: "/robots.txt" },
      { name: "security.txt", url: "/.well-known/security.txt" },
    ];

    const out: CheckResult[] = [];
    for (const c of checks) {
      try {
        const res = await fetch(c.url, { cache: "no-store" });
        let detail: string | undefined;
        if (c.url.endsWith("/ready")) {
          const json = (await res.json()) as { capabilities?: { storage?: string } };
          detail = json.capabilities?.storage
            ? `storage: ${json.capabilities.storage}`
            : undefined;
        }
        out.push({ name: c.name, ok: res.ok, status: res.status, detail });
      } catch {
        out.push({ name: c.name, ok: false, status: 0, detail: "rete" });
      }
    }
    setResults(out);
    setRunning(false);
  }

  return (
    <div className="space-y-3 text-sm">
      <Button type="button" size="sm" variant="outline" onClick={run} disabled={running}>
        {running ? "Verifica in corso…" : "Esegui smoke test (health)"}
      </Button>
      {results ? (
        <ul className="space-y-2">
          {results.map((r) => (
            <li
              key={r.name}
              className={`flex flex-wrap items-baseline justify-between gap-2 rounded-md border p-2 ${
                r.ok ? "border-border/60" : "border-destructive/50"
              }`}
            >
              <span>{r.name}</span>
              <span className={r.ok ? "text-foreground" : "text-destructive"}>
                {r.ok ? "OK" : "Errore"} · HTTP {r.status || "—"}
                {r.detail ? ` · ${r.detail}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Smoke completo:{" "}
          <span className="font-mono">npm run passi-mancanti:full</span> (locale) ·{" "}
          <span className="font-mono">npm run passi-mancanti:prod</span> (env Vercel + smoke)
        </p>
      )}
    </div>
  );
}
