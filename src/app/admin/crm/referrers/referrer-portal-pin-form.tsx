"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setReferrerPortalPinAction } from "@/app/refer/referrer-portal-actions";

export function ReferrerPortalPinForm({ referrerId, hasPin }: { referrerId: string; hasPin: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const pin = (new FormData(e.currentTarget).get("pin") as string) ?? "";
        start(async () => {
          const res = await setReferrerPortalPinAction(referrerId, pin);
          setMessage("ok" in res && res.ok ? "PIN salvato." : "error" in res ? res.error : "");
        });
      }}
    >
      <div>
        <label className="text-xs text-muted-foreground">
          PIN portale {hasPin ? "(imposta nuovo per sostituire)" : "(obbligatorio per login dashboard)"}
        </label>
        <Input name="pin" type="password" minLength={4} maxLength={32} className="mt-1 h-9 w-40" required />
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "…" : "Salva PIN"}
      </Button>
      {message ? <p className="w-full text-xs text-muted-foreground">{message}</p> : null}
    </form>
  );
}
