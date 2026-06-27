"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPost } from "./actions";
import { platformSelectRows } from "@/lib/post-ui-labels";
import type { Client } from "@prisma/client";
import { Select } from "@/components/ui/select";

type PostFormProps = { clients: Client[] };

export function PostForm({ clients }: PostFormProps) {
  const [state, formAction] = useFormState(
    (_: unknown, fd: FormData) => createPost(_, fd),
    null as { error: string } | null
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="clientId">Cliente</Label>
        <Select
          id="clientId"
          name="clientId"
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Seleziona un cliente</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName} ({c.slug})
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="platform">Piattaforma</Label>
        <Select
          id="platform"
          name="platform"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {platformSelectRows().map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="captionText">Didascalia</Label>
        <textarea
          id="captionText"
          name="captionText"
          rows={4}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px]"
          placeholder="Testo del post / didascalia…"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="scheduledFor">Programmato per (opzionale)</Label>
        <Input id="scheduledFor" name="scheduledFor" type="datetime-local" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="media">Media (immagini o video)</Label>
        <Input
          id="media"
          name="media"
          type="file"
          multiple
          accept="image/*,video/*"
          required
          className="cursor-pointer"
        />
        <p className="text-xs text-muted-foreground">
          Almeno un file. Immagini: JPEG, PNG, GIF, WebP. Video: MP4, WebM.
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="submit">Crea post</Button>
        <Button asChild type="button" variant="outline">
          <Link href="/admin/posts">Annulla</Link>
        </Button>
      </div>
    </form>
  );
}
