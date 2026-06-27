"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Asset } from "@prisma/client";
import { createAssetForClient, updateAsset, type AssetActionResult } from "./actions";
import { platformLabel, platformOptions } from "@/lib/platform-label";
import { Select } from "@/components/ui/select";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvataggio…" : label}
    </Button>
  );
}

const initial: AssetActionResult = null;

export function NewAssetForm({ clientId }: { clientId: string }) {
  const [state, formAction] = useFormState(
    (_p: AssetActionResult, fd: FormData) => createAssetForClient(clientId, _p, fd),
    initial
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Nome asset</Label>
          <Input id="name" name="name" required placeholder="Es. Pagina Facebook aziendale" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug (opzionale)</Label>
          <Input id="slug" name="slug" placeholder="Generato dal nome se vuoto" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="platform">Piattaforma (opzionale)</Label>
          <Select
            id="platform"
            name="platform"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue=""
          >
            <option value="">— Nessuna —</option>
            {platformOptions.map((p) => (
              <option key={p} value={p}>
                {platformLabel[p]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="profileUrl">URL profilo (opzionale)</Label>
          <Input id="profileUrl" name="profileUrl" type="url" placeholder="https://g.page/… o Google Maps" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="gbpLocationName">GBP location (opzionale)</Label>
          <Input
            id="gbpLocationName"
            name="gbpLocationName"
            placeholder="accounts/…/locations/…"
          />
          <p className="text-xs text-muted-foreground">
            Per recensioni e risposte live su questo asset. Altrimenti usa GOOGLE_GBP_LOCATION_NAME.
          </p>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">Note (opzionale)</Label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Handle, note operative…"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Submit label="Crea asset" />
        <Button asChild type="button" variant="outline">
          <Link href={`/admin/clients/${clientId}`}>Annulla</Link>
        </Button>
      </div>
    </form>
  );
}

type EditProps = { clientId: string; asset: Asset };

export function EditAssetForm({ clientId, asset }: EditProps) {
  const [state, formAction] = useFormState(
    (_p: AssetActionResult, fd: FormData) => updateAsset(asset.id, clientId, _p, fd),
    initial
  );

  const platformValue = asset.platform ?? "";

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Nome asset</Label>
          <Input id="name" name="name" required defaultValue={asset.name} placeholder="Es. Pagina Facebook aziendale" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" name="slug" defaultValue={asset.slug} placeholder="slug-unico-per-cliente" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="platform">Piattaforma (opzionale)</Label>
          <Select
            id="platform"
            name="platform"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue={platformValue}
          >
            <option value="">— Nessuna —</option>
            {platformOptions.map((p) => (
              <option key={p} value={p}>
                {platformLabel[p]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="profileUrl">URL profilo (opzionale)</Label>
          <Input
            id="profileUrl"
            name="profileUrl"
            type="url"
            defaultValue={asset.profileUrl ?? ""}
            placeholder="https://g.page/… o Google Maps"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="gbpLocationName">GBP location (opzionale)</Label>
          <Input
            id="gbpLocationName"
            name="gbpLocationName"
            defaultValue={asset.gbpLocationName ?? ""}
            placeholder="accounts/…/locations/…"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">Note (opzionale)</Label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={asset.notes ?? ""}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Handle, note operative…"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Submit label="Salva modifiche" />
        <Button asChild type="button" variant="outline">
          <Link href={`/admin/clients/${clientId}`}>Annulla</Link>
        </Button>
      </div>
    </form>
  );
}
