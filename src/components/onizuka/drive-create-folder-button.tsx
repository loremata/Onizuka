"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DriveCreateFolderButton({
  clientId,
  hasFolder,
  driveConfigured,
}: {
  clientId: string;
  hasFolder: boolean;
  driveConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!driveConfigured) {
    return (
      <p className="text-xs text-muted-foreground">
        Per creare cartelle automatiche imposta GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON in .env.
      </p>
    );
  }

  async function create() {
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/drive-folder`, { method: "POST" });
      const body = (await res.json()) as {
        error?: string;
        subfoldersCreated?: number;
        subfoldersExisting?: number;
      };
      if (!res.ok) {
        setError(body.error ?? "Errore");
        return;
      }
      setSuccess(
        `Struttura Drive: ${body.subfoldersCreated ?? 0} cartelle create, ${body.subfoldersExisting ?? 0} già presenti.`
      );
      router.refresh();
    } catch {
      setError("Errore di rete");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => void create()}>
        {pending ? "…" : hasFolder ? "Aggiorna struttura Drive (9 cartelle)" : "Crea cartella + struttura Drive"}
      </Button>
      {success ? <p className="text-xs text-green-600 dark:text-green-400">{success}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
