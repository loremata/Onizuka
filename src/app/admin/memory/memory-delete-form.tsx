"use client";

import { useFormState } from "react-dom";
import { ConfirmSubmitButton } from "@/components/onizuka/confirm-submit-button";
import { deleteMemoryItem, type MemoryActionResult } from "./actions";

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
      <ConfirmSubmitButton label="Elimina voce" question="Eliminare questa voce di memoria?" />
    </form>
  );
}
