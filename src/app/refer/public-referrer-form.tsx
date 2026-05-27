"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitPublicReferrerLead, type PublicReferLeadResult } from "@/app/admin/crm/referrers/actions";
import { ReferrerLeadSuccessPanel } from "./referrer-lead-success";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Invio…" : "Invia segnalazione"}
    </Button>
  );
}

export function PublicReferrerLeadForm({ token, referrerName }: { token: string; referrerName: string }) {
  const [state, formAction] = useFormState(submitPublicReferrerLead, null as PublicReferLeadResult);

  if (state && "ok" in state && state.ok) {
    return <ReferrerLeadSuccessPanel referrerName={referrerName} />;
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden" aria-hidden>
        <label>
          Sito web aziendale
          <input type="text" name="companyWebsite" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {state && "error" in state ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="businessName">Ragione sociale / attività</Label>
        <Input id="businessName" name="businessName" placeholder="Es. Pasticceria Bianchi" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contactName">Nome referente</Label>
        <Input id="contactName" name="contactName" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Telefono</Label>
          <Input id="phone" name="phone" type="tel" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Note (opzionale)</Label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <Submit />
    </form>
  );
}
