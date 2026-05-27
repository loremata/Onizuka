"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getCloudProvisionProvidersAction,
  probeWorkspaceDatabaseHealth,
  runWorkspaceCloudProvision,
  runWorkspaceDatabaseProvision,
  updateWorkspaceDatabaseUrl,
} from "@/app/admin/settings/workspace-database-actions";
import type { CloudProvisionProvider } from "@/lib/workspace-cloud-provision";

type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  databaseSlug: string | null;
  hasDatabaseUrl: boolean;
  databaseProvisionedAt: string | null;
  databaseCloudProvider: string | null;
  databaseCloudRef: string | null;
};

export function WorkspaceDatabasePanel({ workspaces }: { workspaces: WorkspaceRow[] }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [providers, setProviders] = useState<CloudProvisionProvider[]>([]);
  const [pending, start] = useTransition();

  useEffect(() => {
    void getCloudProvisionProvidersAction().then(setProviders);
  }, []);

  if (workspaces.length === 0) return null;

  return (
    <Card className="max-w-2xl border-dashed">
      <CardHeader>
        <CardTitle>Database dedicato workspace</CardTitle>
        <CardDescription>
          Connection string PostgreSQL per tenant enterprise. Alternativa: mappa JSON{" "}
          <code className="text-xs">ONIZUKA_WORKSPACE_DATABASES</code> per <code>databaseSlug</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {workspaces.map((ws) => (
          <WorkspaceDatabaseRow
            key={ws.id}
            workspace={ws}
            providers={providers}
            pending={pending}
            start={start}
            setMsg={setMsg}
          />
        ))}
        {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
      </CardContent>
    </Card>
  );
}

function WorkspaceDatabaseRow({
  workspace,
  providers,
  pending,
  start,
  setMsg,
}: {
  workspace: WorkspaceRow;
  providers: CloudProvisionProvider[];
  pending: boolean;
  start: (fn: () => Promise<void>) => void;
  setMsg: (m: string | null) => void;
}) {
  const [url, setUrl] = useState("");

  return (
    <form
      className="space-y-2 rounded-md border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const res = await updateWorkspaceDatabaseUrl(workspace.id, url || null);
          setMsg(res.error ?? `Salvato per ${workspace.name}`);
        });
      }}
    >
      <p className="font-medium">
        {workspace.name}{" "}
        <span className="text-xs text-muted-foreground">
          ({workspace.slug}
          {workspace.databaseSlug ? ` · slug DB ${workspace.databaseSlug}` : ""}
          {workspace.hasDatabaseUrl ? " · URL impostato" : ""}
          {workspace.databaseProvisionedAt
            ? ` · migrato ${new Date(workspace.databaseProvisionedAt).toLocaleString("it-IT")}`
            : ""}
          {workspace.databaseCloudProvider
            ? ` · cloud ${workspace.databaseCloudProvider}${workspace.databaseCloudRef ? ` (${workspace.databaseCloudRef})` : ""}`
            : ""}
          )
        </span>
      </p>
      <input
        type="text"
        className="w-full rounded-md border border-input bg-background px-2 py-1 font-mono text-xs"
        placeholder="postgresql://user:pass@host:5432/db?schema=public"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          Salva URL
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setUrl("");
            setMsg(null);
            start(async () => {
              const res = await updateWorkspaceDatabaseUrl(workspace.id, null);
              setMsg(res.error ?? `URL rimosso per ${workspace.name}`);
            });
          }}
        >
          Rimuovi
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setMsg(null);
            start(async () => {
              const res = await runWorkspaceDatabaseProvision(workspace.id);
              setMsg(res.error ?? `Migrate deploy OK — ${res.migratedAt ?? ""}`);
            });
          }}
        >
          Provision schema
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setMsg(null);
            start(async () => {
              const res = await probeWorkspaceDatabaseHealth(workspace.id);
              setMsg(res.message);
            });
          }}
        >
          Test connessione
        </Button>
        {providers.includes("supabase") ? (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => {
              setMsg(null);
              start(async () => {
                const res = await runWorkspaceCloudProvision(workspace.id, "supabase");
                setMsg(
                  res.error ??
                    `Supabase OK ref=${res.cloudRef} migrate=${res.migratedAt ?? ""}`
                );
              });
            }}
          >
            Crea DB Supabase
          </Button>
        ) : null}
        {providers.includes("rds") ? (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => {
              setMsg(null);
              start(async () => {
                const res = await runWorkspaceCloudProvision(workspace.id, "rds");
                setMsg(
                  res.error ??
                    `RDS OK db=${res.cloudRef} migrate=${res.migratedAt ?? ""}`
                );
              });
            }}
          >
            Crea DB RDS
          </Button>
        ) : null}
      </div>
    </form>
  );
}
