"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { ClientContact } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteClientContact, updateClientContact, type ContactActionResult } from "../../actions";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvataggio…" : "Salva modifiche"}
    </Button>
  );
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending} form="delete-contact-form">
      {pending ? "Eliminazione…" : "Elimina referente"}
    </Button>
  );
}

const initial: ContactActionResult = null;

export function EditContactForm({ contact, clientId }: { contact: ClientContact; clientId: string }) {
  const [state, formAction] = useFormState(
    updateClientContact.bind(null, contact.id, clientId),
    initial
  );

  return (
    <div className="space-y-8">
      <form action={formAction} className="space-y-4">
        {state?.error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" required defaultValue={contact.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Ruolo (opzionale)</Label>
            <Input id="role" name="role" defaultValue={contact.role ?? ""} placeholder="Es. Marketing manager" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email (opzionale)</Label>
            <Input id="email" name="email" type="email" defaultValue={contact.email ?? ""} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="phone">Telefono (opzionale)</Label>
            <Input id="phone" name="phone" type="tel" defaultValue={contact.phone ?? ""} />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              id="isPrimary"
              name="isPrimary"
              type="checkbox"
              className="h-4 w-4 rounded border-input"
              defaultChecked={contact.isPrimary}
            />
            <Label htmlFor="isPrimary" className="font-normal text-muted-foreground">
              Referente principale
            </Label>
          </div>
        </div>
        <SaveButton />
      </form>

      <form id="delete-contact-form" action={deleteClientContact.bind(null, contact.id, clientId)} className="border-t border-border/60 pt-6">
        <DeleteButton />
      </form>
    </div>
  );
}
