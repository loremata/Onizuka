"use client";

import Link from "next/link";
import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { sendOpsWeeklyDigestAction } from "./ops-digest-actions";

export function InsightsOpsDigestToolbar({ smtpEnabled }: { smtpEnabled: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href="/api/admin/insights/ops-digest">Scarica digest (.txt)</Link>
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending || !smtpEnabled}
        title={smtpEnabled ? undefined : "Configura SMTP per invio email"}
        onClick={() =>
          start(async () => {
            const res = await sendOpsWeeklyDigestAction();
            setMessage(res.ok ? "Digest inviato alla tua email." : res.error);
          })
        }
      >
        {pending ? "…" : "Invia digest via email"}
      </Button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  );
}
