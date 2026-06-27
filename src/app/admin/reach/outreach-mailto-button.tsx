"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { OutreachAbVariant } from "@/lib/outreach-ab";
import { Select } from "@/components/ui/select";

export function OutreachSendButton({
  draftId,
  smtpHint,
  hasAb,
  defaultAbVariant = "A",
}: {
  draftId: string;
  smtpHint?: boolean;
  hasAb?: boolean;
  defaultAbVariant?: OutreachAbVariant;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variant, setVariant] = useState<OutreachAbVariant>(defaultAbVariant);

  async function send(markSent: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, markSent, abVariant: variant }),
      });
      const data = (await res.json()) as {
        mode?: string;
        mailto?: string;
        sent?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Invio fallito");
        return;
      }
      if (data.mode === "mailto" && data.mailto) {
        window.location.href = data.mailto;
        return;
      }
      if (data.sent) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {hasAb ? (
        <Select
          value={variant}
          onChange={(e) => setVariant(e.target.value as OutreachAbVariant)}
          className="h-7 rounded border border-input bg-background px-1 text-xs"
          disabled={loading}
          aria-label="Variante oggetto"
        >
          <option value="A">Oggetto A</option>
          <option value="B">Oggetto B</option>
        </Select>
      ) : null}
      {smtpHint ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 text-xs"
          disabled={loading}
          onClick={() => send(true)}
        >
          {loading ? "…" : "Invia via SMTP"}
        </Button>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        disabled={loading}
        onClick={() => send(false)}
      >
        {loading ? "…" : "Apri in email"}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
