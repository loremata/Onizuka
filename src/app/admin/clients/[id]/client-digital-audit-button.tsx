"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { startDigitalAuditForClientId } from "@/app/admin/audit/digital/actions";

export function ClientDigitalAuditButton({ clientId }: { clientId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const result = await startDigitalAuditForClientId(clientId, true);
            if (result && "error" in result) {
              setError(result.error);
              return;
            }
            if (result && "auditId" in result) {
              router.push(`/admin/audit/digital/${result.auditId}`);
            }
          });
        }}
      >
        {pending ? "Audit in corso…" : "Avvia audit digitale"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
