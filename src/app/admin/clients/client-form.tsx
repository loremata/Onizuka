"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient, updateClient } from "./actions";
import type { Client } from "@prisma/client";
import { clientStatusLabel, clientStatusOptions } from "@/lib/crm-client-status";
import { clientKindLabel, clientMacroCategoryLabel } from "@/lib/client-kind";
import type { ClientKind, ClientMacroCategory } from "@prisma/client";
import { Select } from "@/components/ui/select";

type ClientFormProps = { client?: Client };

export function ClientForm({ client }: ClientFormProps) {
  const isEdit = !!client;
  const [state, formAction] = useFormState(
    isEdit
      ? (_: unknown, fd: FormData) => updateClient(client.id, _, fd)
      : (_: unknown, fd: FormData) => createClient(_, fd),
    null as { error: string } | null
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="companyName">Ragione sociale</Label>
          <Input
            id="companyName"
            name="companyName"
            required
            defaultValue={client?.companyName}
            placeholder="Es. Azienda S.r.l."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            name="slug"
            defaultValue={client?.slug}
            placeholder="es. azienda-srl (opzionale; generato dalla ragione sociale se vuoto)"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactEmail">Email di contatto</Label>
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            required
            defaultValue={client?.contactEmail}
            placeholder="contact@acme.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Stato pipeline</Label>
          <Select
            id="status"
            name="status"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue={client?.status ?? "ACTIVE_CLIENT"}
          >
            {clientStatusOptions.map((s) => (
              <option key={s} value={s}>
                {clientStatusLabel[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ticketSlaHours">SLA ticket (ore, opzionale)</Label>
          <Input
            id="ticketSlaHours"
            name="ticketSlaHours"
            type="number"
            min={1}
            max={720}
            defaultValue={client?.ticketSlaHours ?? ""}
            placeholder="Vuoto = env TICKET_SLA_HOURS (48)"
          />
          <p className="text-xs text-muted-foreground">Ore per prima risposta sui ticket portale di questo cliente.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="accountingCode">Conto PDC gestionale (opzionale)</Label>
          <Input
            id="accountingCode"
            name="accountingCode"
            defaultValue={client?.accountingCode ?? ""}
            placeholder="es. 4105001"
            pattern="[0-9A-Za-z]{3,12}"
            title="3–12 caratteri alfanumerici"
          />
          <p className="text-xs text-muted-foreground">Usato nell&apos;export contabile Finance per questo cliente.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="kind">Tipo cliente</Label>
          <Select
            id="kind"
            name="kind"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue={client?.kind ?? ""}
          >
            <option value="">Auto (da CF / P.IVA)</option>
            {(Object.keys(clientKindLabel) as ClientKind[]).map((k) => (
              <option key={k} value={k}>
                {clientKindLabel[k]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="clientMacroCategory">Macro-categoria</Label>
          <Select
            id="clientMacroCategory"
            name="clientMacroCategory"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue={client?.clientMacroCategory ?? ""}
          >
            <option value="">—</option>
            {(Object.keys(clientMacroCategoryLabel) as ClientMacroCategory[]).map((m) => (
              <option key={m} value={m}>
                {clientMacroCategoryLabel[m]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fiscalCode">Codice fiscale (privato)</Label>
          <Input id="fiscalCode" name="fiscalCode" defaultValue={client?.fiscalCode ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vatNumber">Partita IVA (azienda)</Label>
          <Input id="vatNumber" name="vatNumber" defaultValue={client?.vatNumber ?? ""} placeholder="IT…" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefono (opzionale)</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={client?.phone ?? ""} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="website">Sito web (opzionale)</Label>
          <Input id="website" name="website" defaultValue={client?.website ?? ""} placeholder="https://…" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="driveFolderUrl">Cartella Google Drive (URL, opzionale)</Label>
          <Input
            id="driveFolderUrl"
            name="driveFolderUrl"
            type="url"
            defaultValue={client?.driveFolderUrl ?? ""}
            placeholder="https://drive.google.com/drive/folders/…"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="address">Indirizzo (opzionale)</Label>
          <Input id="address" name="address" defaultValue={client?.address ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">Città (opzionale)</Label>
          <Input id="city" name="city" defaultValue={client?.city ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Paese</Label>
          <Input id="country" name="country" defaultValue={client?.country ?? "IT"} placeholder="IT" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">Note (opzionale)</Label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            defaultValue={client?.notes ?? ""}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Contesto commerciale, preferenze, vincoli…"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit">{isEdit ? "Salva modifiche" : "Crea cliente"}</Button>
        <Button asChild type="button" variant="outline">
          <Link href="/admin/clients">Annulla</Link>
        </Button>
      </div>
    </form>
  );
}
