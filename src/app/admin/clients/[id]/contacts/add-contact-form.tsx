"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClientContact, type ContactActionResult } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvataggio…" : "Aggiungi referente"}
    </Button>
  );
}

const initial: ContactActionResult = null;

export function AddContactForm({ clientId }: { clientId: string }) {
  const [state, formAction] = useFormState(createClientContact.bind(null, clientId), initial);

  return (
    <form action={formAction} className="space-y-4 border-t border-border/60 pt-6">
      <h3 className="text-sm font-semibold">Nuovo referente</h3>
      {state?.error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" name="name" required placeholder="Nome e cognome" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Ruolo (opzionale)</Label>
          <Input id="role" name="role" placeholder="Es. Marketing manager" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email (opzionale)</Label>
          <Input id="email" name="email" type="email" placeholder="nome@azienda.it" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="phone">Telefono (opzionale)</Label>
          <Input id="phone" name="phone" type="tel" placeholder="+39 …" />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <input id="isPrimary" name="isPrimary" type="checkbox" className="h-4 w-4 rounded border-input" />
          <Label htmlFor="isPrimary" className="font-normal text-muted-foreground">
            Imposta come referente principale
          </Label>
        </div>
      </div>
      <SubmitButton />
    </form>
  );
}
