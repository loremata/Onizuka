"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function SendDigestButton({
  action,
  enabled,
}: {
  action: () => Promise<{ error?: string; sent?: number } | void>;
  enabled: boolean;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (!enabled) {
    return (
      <span className="text-xs text-muted-foreground">Configura GMAIL_SMTP_* e NOTIFY_DIGEST_EMAIL=1</span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          setMessage(null);
          start(async () => {
            const result = await action();
            if (result && "error" in result && result.error) {
              setMessage(result.error);
              return;
            }
            if (result && "sent" in result && result.sent) {
              setMessage(`Inviate ${result.sent} voci via email.`);
            }
          });
        }}
      >
        {pending ? "…" : "Invia digest email"}
      </Button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  );
}
