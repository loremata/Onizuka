"use client";

import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFlowTask, type FlowActionResult } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvataggio…" : "Crea task"}
    </Button>
  );
}

const initialState: FlowActionResult = null;

export function FlowTaskForm({
  clients,
  dueDateCaption,
}: {
  clients: { id: string; companyName: string }[];
  /** Testo sotto la scadenza (es. fuso IANA come Command Center). */
  dueDateCaption?: string;
}) {
  const [state, formAction] = useFormState(createFlowTask, initialState);
  const titleRef = useRef<HTMLInputElement>(null);

  function applyMeetingTemplate() {
    const el = titleRef.current;
    if (!el) return;
    if (!el.value.startsWith("[Meeting]")) {
      el.value = `[Meeting] ${el.value}`.trim();
    }
    el.focus();
  }

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="title">Titolo</Label>
            <Button type="button" variant="outline" size="sm" onClick={applyMeetingTemplate}>
              Template meeting
            </Button>
          </div>
          <Input
            id="title"
            name="title"
            ref={titleRef}
            required
            placeholder="Es. [Meeting] Kickoff cliente…"
          />
          <p className="text-xs text-muted-foreground">
            Prefisso <code className="text-[10px]">[Meeting]</code> abilita promemoria follow-up dopo completamento.
          </p>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">Descrizione (opzionale)</Label>
          <textarea
            id="description"
            name="description"
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="Dettagli o contesto"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">Priorità</Label>
          <select
            id="priority"
            name="priority"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue="MEDIUM"
          >
            <option value="LOW">Bassa</option>
            <option value="MEDIUM">Media</option>
            <option value="HIGH">Alta</option>
            <option value="URGENT">Urgente</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Stato iniziale</Label>
          <select
            id="status"
            name="status"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue="TODO"
          >
            <option value="TODO">Da fare</option>
            <option value="IN_PROGRESS">In corso</option>
            <option value="WAITING">In attesa</option>
            <option value="DONE">Completato</option>
            <option value="CANCELLED">Annullato</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dueDate">Scadenza (opzionale)</Label>
          <Input id="dueDate" name="dueDate" type="datetime-local" />
          {dueDateCaption ? <p className="text-xs text-muted-foreground">{dueDateCaption}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="relatedClientId">Cliente collegato (opzionale)</Label>
          <select
            id="relatedClientId"
            name="relatedClientId"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue=""
          >
            <option value="">— Nessuno —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>
        </div>
      </div>
      <SubmitButton />
    </form>
  );
}
