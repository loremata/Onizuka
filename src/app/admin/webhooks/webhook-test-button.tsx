"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function WebhookTestButton({ webhookId }: { webhookId: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runTest() {
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/webhooks/${webhookId}/test`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        setMessage(`OK (${body.status ?? res.status})`);
      } else {
        setMessage(body.error ?? `Errore ${res.status}`);
      }
    } catch {
      setMessage("Richiesta fallita");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={runTest}>
        {pending ? "…" : "Test"}
      </Button>
      {message ? <span className="max-w-[12rem] text-right text-xs text-muted-foreground">{message}</span> : null}
    </div>
  );
}
