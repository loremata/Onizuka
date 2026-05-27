"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import type { Lead } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createLead, updateLead, type LeadActionResult } from "./actions";
import { leadStatusLabel, leadStatusOptions } from "@/lib/crm-lead-status";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvataggio…" : label}
    </Button>
  );
}

const initial: LeadActionResult = null;

type ClientOpt = { id: string; companyName: string };

type ReferrerOpt = { id: string; name: string };

type Props = { clients: ClientOpt[]; referrers?: ReferrerOpt[]; lead?: Lead };

export function LeadForm({ clients, referrers = [], lead }: Props) {
  const isEdit = !!lead;
  const [state, formAction] = useFormState(
    isEdit ? (_p: LeadActionResult, fd: FormData) => updateLead(lead.id, _p, fd) : createLead,
    initial
  );

  return (
    <form action={formAction} className="space-y-4">
      {state && "error" in state && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">Titolo lead</Label>
          <Input id="title" name="title" required defaultValue={lead?.title} placeholder="Es. Contatto da fiera" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Stato</Label>
          <select
            id="status"
            name="status"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue={lead?.status ?? "NEW"}
          >
            {leadStatusOptions.map((s) => (
              <option key={s} value={s}>
                {leadStatusLabel[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="referrerId">Segnalatore (opzionale)</Label>
          <select
            id="referrerId"
            name="referrerId"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue={lead?.referrerId ?? ""}
          >
            <option value="">— Nessuno —</option>
            {referrers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="source">Origine (opzionale)</Label>
          <Input id="source" name="source" defaultValue={lead?.source ?? ""} placeholder="sito, referral, lista, …" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactName">Nome contatto</Label>
          <Input id="contactName" name="contactName" defaultValue={lead?.contactName ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="businessName">Ragione sociale presunta</Label>
          <Input id="businessName" name="businessName" defaultValue={lead?.businessName ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={lead?.email ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefono</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={lead?.phone ?? ""} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="vatNumber">Partita IVA (opzionale)</Label>
          <Input id="vatNumber" name="vatNumber" defaultValue={lead?.vatNumber ?? ""} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="convertedClientId">Cliente CRM collegato (conversione, opzionale)</Label>
          <select
            id="convertedClientId"
            name="convertedClientId"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue={lead?.convertedClientId ?? ""}
          >
            <option value="">— Nessuno —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">Note</Label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            defaultValue={lead?.notes ?? ""}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Submit label={isEdit ? "Salva" : "Crea lead"} />
        <Button asChild type="button" variant="outline">
          <Link href="/admin/crm/leads">Annulla</Link>
        </Button>
      </div>
    </form>
  );
}
