"use client";

import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { approvePost, requestChanges } from "../../actions";

type Props = { postId: string };

export function PostActions({ postId }: Props) {
  const [approveState, approveAction] = useFormState(
    (_: unknown, fd: FormData) => approvePost(postId, _, fd),
    null as { error: string } | null
  );
  const [requestState, requestAction] = useFormState(
    (_: unknown, fd: FormData) => requestChanges(postId, _, fd),
    null as { error: string } | null
  );

  const error = approveState?.error ?? requestState?.error;

  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-sm font-medium">Azioni</p>
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <form action={approveAction} className="space-y-2 rounded-lg border p-4">
          <Label>Approva questo post</Label>
          <p className="text-xs text-muted-foreground">Puoi aggiungere un commento (opzionale).</p>
          <textarea
            name="comment"
            rows={2}
            placeholder="Commento opzionale…"
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[60px]"
          />
          <Button type="submit" className="w-full sm:w-auto">
            Approva
          </Button>
        </form>

        <form action={requestAction} className="space-y-2 rounded-lg border p-4">
          <Label>Richiedi modifiche</Label>
          <p className="text-xs text-muted-foreground">Il commento è obbligatorio per capire cosa cambiare.</p>
          <textarea
            name="comment"
            rows={2}
            required
            placeholder="Descrivi cosa vorresti modificare…"
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[60px]"
          />
          <Button type="submit" variant="outline" className="w-full sm:w-auto">
            Richiedi modifiche
          </Button>
        </form>
      </div>
    </div>
  );
}
