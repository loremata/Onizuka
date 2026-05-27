"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createReferrer, updateReferrer, type ReferrerActionResult } from "./actions";
import type { Referrer } from "@prisma/client";

export function ReferrerForm({ referrer }: { referrer?: Referrer }) {
  const isEdit = !!referrer;
  const [state, formAction] = useFormState(
    isEdit
      ? (_: ReferrerActionResult, fd: FormData) => updateReferrer(referrer.id, _, fd)
      : createReferrer,
    null as ReferrerActionResult
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="name">Nome segnalatore</Label>
        <Input id="name" name="name" required defaultValue={referrer?.name} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={referrer?.email ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefono</Label>
          <Input id="phone" name="phone" defaultValue={referrer?.phone ?? ""} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="commissionPercent">Percentuale provvigione (0–100, opzionale)</Label>
        <Input
          id="commissionPercent"
          name="commissionPercent"
          type="number"
          min={0}
          max={100}
          step="0.01"
          placeholder="Es. 10"
          defaultValue={referrer?.commissionPercent != null ? referrer.commissionPercent.toString() : ""}
        />
        <p className="text-xs text-muted-foreground">
          Usata sul portale `/refer` per stimare la provvigione su opportunità <strong>WON</strong> dei clienti nati dai
          tuoi lead convertiti (indicativa, non vincolante).
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="payoutIban">IBAN liquidazioni (opzionale)</Label>
        <Input
          id="payoutIban"
          name="payoutIban"
          placeholder="IT00 X000 0000 0000 0000 0000 000"
          defaultValue={referrer?.payoutIban ?? ""}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Mostrato mascherato sul portale segnalatore dopo login PIN.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="commissionNotes">Note commissioni</Label>
        <textarea
          id="commissionNotes"
          name="commissionNotes"
          rows={3}
          defaultValue={referrer?.commissionNotes ?? ""}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={referrer?.active ?? true} />
        Attivo
      </label>
      <div className="flex gap-2">
        <Button type="submit">{isEdit ? "Salva" : "Crea"}</Button>
        <Button asChild type="button" variant="outline">
          <Link href="/admin/crm/referrers">Annulla</Link>
        </Button>
      </div>
    </form>
  );
}
