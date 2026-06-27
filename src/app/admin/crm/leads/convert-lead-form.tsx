"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { convertLeadToClient, type LeadActionResult } from "./actions";
import { clientStatusLabel, clientStatusOptions } from "@/lib/crm-client-status";
import { Select } from "@/components/ui/select";

export type ConvertLeadFormDefaults = {
  leadId: string;
  companyName: string;
  contactEmail: string;
  phone: string;
  vatNumber: string;
};

export function ConvertLeadForm({
  leadId,
  companyName,
  contactEmail,
  phone,
  vatNumber,
}: ConvertLeadFormDefaults) {
  const [state, formAction] = useFormState<LeadActionResult, FormData>(
    (_prev, fd) => convertLeadToClient(leadId, _prev, fd),
    null
  );

  return (
    <form action={formAction} className="space-y-4">
      {state && "error" in state && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="companyName">Ragione sociale</Label>
          <Input
            id="companyName"
            name="companyName"
            required
            defaultValue={companyName}
            placeholder="Es. Azienda S.r.l."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            name="slug"
            placeholder="Opzionale; generato dalla ragione sociale se vuoto"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactEmail">Email di contatto</Label>
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            required
            defaultValue={contactEmail}
            placeholder="contact@acme.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Stato cliente</Label>
          <Select
            id="status"
            name="status"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue="ACTIVE_CLIENT"
          >
            {clientStatusOptions.map((s) => (
              <option key={s} value={s}>
                {clientStatusLabel[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="vatNumber">Partita IVA (opzionale)</Label>
          <Input id="vatNumber" name="vatNumber" defaultValue={vatNumber} placeholder="IT…" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefono (opzionale)</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={phone} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="website">Sito web (opzionale)</Label>
          <Input id="website" name="website" placeholder="https://…" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="address">Indirizzo (opzionale)</Label>
          <Input id="address" name="address" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">Città (opzionale)</Label>
          <Input id="city" name="city" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Paese</Label>
          <Input id="country" name="country" defaultValue="IT" placeholder="IT" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">Note aggiuntive sul cliente (opzionale)</Label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Le note del lead vengono conservate automaticamente nella scheda cliente."
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit">Crea cliente e collega lead</Button>
        <Button asChild type="button" variant="outline">
          <Link href={`/admin/crm/leads/${leadId}/edit`}>Annulla</Link>
        </Button>
      </div>
    </form>
  );
}
