"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DriveStructureButton({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function onProvision() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/drive-folder`, { method: "POST" });
      const data = (await res.json()) as {
        error?: string;
        subfoldersCreated?: number;
        subfoldersExisting?: number;
        driveFolderUrl?: string;
      };
      if (!res.ok) {
        setMessage(data.error ?? "Errore");
        return;
      }
      setMessage(
        `Struttura OK: ${data.subfoldersCreated ?? 0} cartelle create, ${data.subfoldersExisting ?? 0} già presenti.`
      );
      router.refresh();
    } catch {
      setMessage("Richiesta fallita");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="secondary" size="sm" disabled={loading} onClick={onProvision}>
        {loading ? "…" : "Crea / aggiorna struttura Drive"}
      </Button>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
