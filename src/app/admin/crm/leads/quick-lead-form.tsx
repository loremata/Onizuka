"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createQuickLead, type LeadActionResult } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvataggio…" : "Registra lead"}
    </Button>
  );
}

type ReferrerOpt = { id: string; name: string };

export function QuickLeadForm({ referrers }: { referrers: ReferrerOpt[] }) {
  const [state, formAction] = useFormState(createQuickLead, null as LeadActionResult);

  return (
    <form action={formAction} className="space-y-4">
      {state && "error" in state && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="businessName">Ragione sociale</Label>
          <Input id="businessName" name="businessName" placeholder="Es. Bar Roma Srl" autoFocus />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactName">Nome contatto</Label>
          <Input id="contactName" name="contactName" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefono</Label>
          <Input id="phone" name="phone" type="tel" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="email">Email (opzionale)</Label>
          <Input id="email" name="email" type="email" />
        </div>
        {referrers.length > 0 ? (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="referrerId">Segnalatore</Label>
            <select
              id="referrerId"
              name="referrerId"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="">— Nessuno —</option>
              {referrers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Submit />
        <Button asChild type="button" variant="outline">
          <Link href="/admin/crm/leads">Annulla</Link>
        </Button>
      </div>
    </form>
  );
}
