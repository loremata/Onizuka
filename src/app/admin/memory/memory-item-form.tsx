"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import type { MemoryItem } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMemoryItem, updateMemoryItem, type MemoryActionResult } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvataggio…" : label}
    </Button>
  );
}

const initialState: MemoryActionResult = null;

type ClientOption = { id: string; companyName: string };

type AssetOption = { id: string; clientId: string; name: string };

type Props = {
  clients: ClientOption[];
  assets: AssetOption[];
  memory?: MemoryItem;
};

export function MemoryItemForm({ clients, assets, memory }: Props) {
  const isEdit = !!memory;
  const defaultClientId = memory?.relatedClientId ?? "";
  const initialAssetId =
    memory?.relatedAssetId &&
    assets.some(
      (a) =>
        a.id === memory.relatedAssetId && (!memory.relatedClientId || a.clientId === memory.relatedClientId)
    )
      ? memory.relatedAssetId
      : "";

  const [relatedClientId, setRelatedClientId] = useState(defaultClientId);
  const [relatedAssetId, setRelatedAssetId] = useState(initialAssetId);

  const [state, formAction] = useFormState(
    isEdit
      ? (_prev: MemoryActionResult, fd: FormData) => updateMemoryItem(memory.id, _prev, fd)
      : createMemoryItem,
    initialState
  );

  const tagsDisplay = memory?.tags?.length ? memory.tags.join(", ") : "";

  const assetChoices = assets.filter((a) => !relatedClientId || a.clientId === relatedClientId);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200/90">
        Ambito <strong>SENSITIVE</strong>: in MVP i dati restano in chiaro nel database; la cifratura e i flussi di
        consenso sono in roadmap (specifica memoria sensibile).
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">Titolo</Label>
          <Input id="title" name="title" required defaultValue={memory?.title} placeholder="Titolo sintetico" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="scope">Ambito</Label>
          <select
            id="scope"
            name="scope"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue={memory?.scope ?? "BUSINESS"}
          >
            <option value="PERSONAL">Personale</option>
            <option value="BUSINESS">Business</option>
            <option value="ASSET">Asset / brand</option>
            <option value="CLIENT">Cliente</option>
            <option value="EPISODIC">Episodica</option>
            <option value="DOCUMENTAL">Documentale</option>
            <option value="SENSITIVE">Sensibile</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sensitivity">Sensibilità</Label>
          <select
            id="sensitivity"
            name="sensitivity"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue={memory?.sensitivity ?? "LOW"}
          >
            <option value="LOW">Bassa</option>
            <option value="MEDIUM">Media</option>
            <option value="HIGH">Alta</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="source">Origine</Label>
          <select
            id="source"
            name="source"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue={memory?.source ?? "MANUAL"}
          >
            <option value="MANUAL">Manuale</option>
            <option value="VOICE">Voce</option>
            <option value="CHAT">Chat</option>
            <option value="DOCUMENT">Documento</option>
            <option value="SYSTEM">Sistema</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tags">Tag (separati da virgola)</Label>
          <Input id="tags" name="tags" defaultValue={tagsDisplay} placeholder="es. follow-up, energia" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="relatedClientId">Cliente collegato</Label>
          <select
            id="relatedClientId"
            name="relatedClientId"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={relatedClientId}
            onChange={(e) => {
              const next = e.target.value;
              setRelatedClientId(next);
              setRelatedAssetId((prev) => {
                const keep = assets.some((a) => a.id === prev && (!next || a.clientId === next));
                return keep ? prev : "";
              });
            }}
          >
            <option value="">— Nessuno —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="relatedAssetId">Asset collegato (opzionale)</Label>
          <select
            id="relatedAssetId"
            name="relatedAssetId"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={relatedAssetId}
            onChange={(e) => setRelatedAssetId(e.target.value)}
          >
            <option value="">— Nessuno —</option>
            {assetChoices.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Seleziona un cliente per filtrare gli asset del catalogo CRM. Con cliente, solo asset di quel cliente.
          </p>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="content">Contenuto</Label>
          <textarea
            id="content"
            name="content"
            required
            rows={8}
            defaultValue={memory?.content}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Testo della memoria: fatti, preferenze, contesto operativo…"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <SubmitButton label={isEdit ? "Salva modifiche" : "Crea memoria"} />
        <Button asChild type="button" variant="outline">
          <Link href="/admin/memory">Annulla</Link>
        </Button>
      </div>
    </form>
  );
}
