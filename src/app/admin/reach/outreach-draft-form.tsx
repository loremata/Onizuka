"use client";

import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createOutreachDraft } from "./actions";
import { Select } from "@/components/ui/select";

type ClientOption = { id: string; companyName: string };

export function OutreachDraftForm({ clients }: { clients: ClientOption[] }) {
  const [state, action, pending] = useFormState(createOutreachDraft, null);

  return (
    <form action={action} className="space-y-3">
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <div className="space-y-1">
        <label htmlFor="clientId" className="text-xs font-medium text-muted-foreground">
          Cliente (opzionale)
        </label>
        <Select
          id="clientId"
          name="clientId"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          disabled={pending}
        >
          <option value="">—</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <label htmlFor="subject" className="text-xs font-medium text-muted-foreground">
          Oggetto (variante A)
        </label>
        <Input id="subject" name="subject" required disabled={pending} />
      </div>
      <div className="space-y-1">
        <label htmlFor="subjectAlt" className="text-xs font-medium text-muted-foreground">
          Oggetto B (A/B test, opzionale)
        </label>
        <Input id="subjectAlt" name="subjectAlt" disabled={pending} placeholder="Seconda subject line" />
      </div>
      <div className="space-y-1">
        <label htmlFor="body" className="text-xs font-medium text-muted-foreground">
          Corpo (variante A)
        </label>
        <textarea
          id="body"
          name="body"
          required
          rows={5}
          disabled={pending}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="bodyAlt" className="text-xs font-medium text-muted-foreground">
          Corpo B (A/B test, opzionale)
        </label>
        <textarea
          id="bodyAlt"
          name="bodyAlt"
          rows={4}
          disabled={pending}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Testo alternativo per variante B"
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        Salva bozza
      </Button>
    </form>
  );
}
