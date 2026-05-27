"use client";

import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClientTicket } from "./actions";
import { TICKET_MAX_FILES } from "@/lib/ticket-upload";

export function TicketForm() {
  const [state, action, pending] = useFormState(createClientTicket, null);

  return (
    <form action={action} className="space-y-3" encType="multipart/form-data">
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <div className="space-y-1">
        <label htmlFor="title" className="text-sm font-medium">
          Oggetto
        </label>
        <Input id="title" name="title" required minLength={3} disabled={pending} />
      </div>
      <div className="space-y-1">
        <label htmlFor="body" className="text-sm font-medium">
          Dettaglio
        </label>
        <textarea
          id="body"
          name="body"
          required
          minLength={10}
          rows={4}
          disabled={pending}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="attachments" className="text-sm font-medium">
          Allegati (opzionale)
        </label>
        <input
          id="attachments"
          name="attachments"
          type="file"
          multiple
          accept="image/*,application/pdf"
          disabled={pending}
          className="block w-full text-xs text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground">
          Max {TICKET_MAX_FILES} file, 5 MB ciascuno · immagini o PDF
        </p>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Invio…" : "Apri ticket"}
      </Button>
    </form>
  );
}
