"use client";

import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWebhook } from "./actions";

type Props = { clients: { id: string; companyName: string; slug: string }[] };

export function WebhookForm({ clients }: Props) {
  const [state, formAction] = useFormState(
    (_: unknown, fd: FormData) => createWebhook(_, fd),
    null as { error: string } | null
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="event">Evento</Label>
          <select
            id="event"
            name="event"
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="POST_APPROVED">POST_APPROVED</option>
            <option value="POST_STATUS_CHANGED">POST_STATUS_CHANGED</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="clientId">Cliente (opzionale)</Label>
          <select
            id="clientId"
            name="clientId"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Tutti i clienti</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName} ({c.slug})
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="targetUrl">URL di destinazione</Label>
        <Input
          id="targetUrl"
          name="targetUrl"
          type="url"
          required
          placeholder="https://tuo-n8n.com/webhook/..."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="secret">Secret (firma HMAC-SHA256)</Label>
        <Input
          id="secret"
          name="secret"
          type="password"
          required
          placeholder="Secret condiviso con n8n"
        />
      </div>
      <Button type="submit">Aggiungi webhook</Button>
    </form>
  );
}
