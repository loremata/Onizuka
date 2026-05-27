"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { regenerateReferrerPortalToken } from "./actions";

type Props = {
  referrerId: string;
  submissionToken: string | null;
  publicBaseUrl: string;
};

export function ReferrerPortalCard({ referrerId, submissionToken, publicBaseUrl }: Props) {
  const [pending, start] = useTransition();
  const [token, setToken] = useState(submissionToken);
  const [err, setErr] = useState<string | null>(null);

  const url = token ? `${publicBaseUrl.replace(/\/$/, "")}/refer?t=${encodeURIComponent(token)}` : null;

  return (
    <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
      <p className="font-medium">Portale segnalatore (pubblico)</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Condividi il link con il segnalatore: può inviare lead senza login. Rigenera il link se compromesso.
      </p>
      {url ? (
        <div className="mt-3 break-all font-mono text-xs">{url}</div>
      ) : (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Nessun token attivo — genera un link.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setErr(null);
            start(async () => {
              const res = await regenerateReferrerPortalToken(referrerId);
              if ("error" in res) setErr(res.error);
              else setToken(res.token);
            });
          }}
        >
          {pending ? "…" : token ? "Rigenera link" : "Genera link"}
        </Button>
        {url ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
              } catch {
                setErr("Copia manuale dal campo sopra.");
              }
            }}
          >
            Copia link
          </Button>
        ) : null}
      </div>
      {err ? <p className="mt-2 text-xs text-destructive">{err}</p> : null}
    </div>
  );
}
