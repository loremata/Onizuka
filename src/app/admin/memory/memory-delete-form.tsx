"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { deleteMemoryItem, type MemoryActionResult } from "./actions";

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" size="sm" disabled={pending}>
      {pending ? "Eliminazione…" : "Elimina voce"}
    </Button>
  );
}

const initialState: MemoryActionResult = null;

export function MemoryDeleteForm({ memoryId }: { memoryId: string }) {
  const [state, formAction] = useFormState(deleteMemoryItem, initialState);

  return (
    <form action={formAction} className="space-y-2 border-t border-border pt-4">
      <input type="hidden" name="id" value={memoryId} />
      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">Eliminazione definitiva della voce di memoria.</p>
      <DeleteButton />
    </form>
  );
}
