"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginReferrerPortal, type ReferrerPortalLoginResult } from "./referrer-portal-actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "…" : "Accedi"}
    </Button>
  );
}

export function ReferrerPortalLogin({ token }: { token: string }) {
  const [state, action] = useFormState(loginReferrerPortal, undefined);

  if (state && "ok" in state && state.ok) {
    return (
      <p className="text-sm text-green-700 dark:text-green-300">
        Accesso effettuato. La pagina si aggiorna…
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-1">
        <Label htmlFor="pin">PIN portale</Label>
        <Input id="pin" name="pin" type="password" inputMode="numeric" autoComplete="current-password" required />
        <p className="text-xs text-muted-foreground">PIN fornito dall&apos;agenzia sulla scheda segnalatore.</p>
      </div>
      {state && "error" in state ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Submit />
    </form>
  );
}
