"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type DeployStatusPayload = {
  environment: string;
  onizukaEnv: string;
  vercelEnv: string | null;
  appUrl: string | null;
  vercel: boolean;
  database: "ok" | "error";
  productionReady: boolean;
  issues: string[];
  warnings: string[];
  capabilities: {
    storage: string;
    smtp: boolean;
    cron: boolean;
    n8n: boolean;
    upstashLoginRateLimit: boolean;
    redisApiRateLimit: boolean;
    primaryHost: string | null;
    googleDriveApi?: boolean;
    llm?: boolean;
    notificationBus?: boolean;
    marketingUrl?: string | null;
  };
};

export function DeployStatusPanel() {
  const [data, setData] = useState<DeployStatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    fetch("/api/admin/deploy-status")
      .then(async (res) => {
        if (!res.ok) throw new Error("status");
        return res.json() as Promise<DeployStatusPayload>;
      })
      .then(setData)
      .catch(() => setError("Impossibile caricare lo stato deploy"));
  }

  useEffect(() => {
    load();
  }, []);

  if (error) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-destructive">{error}</p>
        <Button type="button" size="sm" variant="outline" onClick={load}>
          Riprova
        </Button>
      </div>
    );
  }

  if (!data) return <p className="text-sm text-muted-foreground">Caricamento stato deploy…</p>;

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          Ambiente: <span className="font-mono font-medium">{data.environment}</span>
          {data.onizukaEnv !== data.environment ? (
            <> · Onizuka <span className="font-mono text-primary">{data.onizukaEnv}</span></>
          ) : null}
          {data.vercelEnv && data.vercelEnv !== data.environment ? (
            <> · <span className="font-mono text-muted-foreground">{data.vercelEnv}</span></>
          ) : null}
          {data.vercel ? " · Vercel" : ""}
        </p>
        <Button type="button" size="sm" variant="ghost" onClick={load}>
          Aggiorna
        </Button>
      </div>

      <p>
        Database:{" "}
        <span className={data.database === "ok" ? "text-green-600" : "text-destructive"}>
          {data.database === "ok" ? "connesso" : "non disponibile"}
        </span>
      </p>

      {data.appUrl ? (
        <p>
          URL app:{" "}
          <a href={data.appUrl} className="text-primary hover:underline" target="_blank" rel="noreferrer">
            {data.appUrl}
          </a>
        </p>
      ) : null}

      <ul className="space-y-1.5 rounded-md border border-border/60 p-3">
        <li>
          Storage: <strong>{data.capabilities.storage}</strong>
        </li>
        <li>SMTP: {data.capabilities.smtp ? "sì" : "no"}</li>
        <li>Cron: {data.capabilities.cron ? "sì" : "no"}</li>
        <li>n8n: {data.capabilities.n8n ? "sì" : "no"}</li>
        <li>Upstash login: {data.capabilities.upstashLoginRateLimit ? "sì" : "no"}</li>
        <li>Redis API: {data.capabilities.redisApiRateLimit ? "sì" : "no"}</li>
        <li>Bus notifiche Upstash: {data.capabilities.notificationBus ? "sì" : "no"}</li>
        <li>Google Drive API: {data.capabilities.googleDriveApi ? "sì" : "no"}</li>
        <li>LLM: {data.capabilities.llm ? "sì" : "no"}</li>
        {data.capabilities.primaryHost ? (
          <li>
            Host primario: <span className="font-mono">{data.capabilities.primaryHost}</span>
          </li>
        ) : null}
      </ul>

      {data.issues.length > 0 ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <p className="font-medium text-destructive">Blocchi go-live</p>
          <ul className="mt-1 list-inside list-disc text-destructive/90">
            {data.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-md border border-green-500/30 bg-green-500/5 p-3 text-green-700 dark:text-green-400">
          Nessun blocco critico rilevato dalle variabili ambiente.
        </p>
      )}

      {data.warnings.length > 0 ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="font-medium text-amber-700 dark:text-amber-400">Avvisi</p>
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            {data.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Documentazione: <span className="font-mono">docs/DEPLOY.md</span> nel repository. In locale prima
        del push: <span className="font-mono">npm run deploy:check</span>
      </p>
    </div>
  );
}
