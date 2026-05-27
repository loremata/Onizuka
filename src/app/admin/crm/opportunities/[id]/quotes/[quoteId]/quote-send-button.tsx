"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function QuoteSendButton({ quoteId, enabled }: { quoteId: string; enabled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!enabled) {
    return (
      <span className="text-xs text-muted-foreground">Configura GMAIL_SMTP_* per inviare via email.</span>
    );
  }

  async function send() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}/send`, { method: "POST" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Invio fallito");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="secondary" disabled={loading} onClick={send}>
        {loading ? "…" : "Invia via email"}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
