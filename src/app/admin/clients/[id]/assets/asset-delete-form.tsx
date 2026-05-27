"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { deleteAsset, type AssetActionResult } from "./actions";

function DelBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" size="sm" disabled={pending}>
      {pending ? "Eliminazione…" : "Elimina asset"}
    </Button>
  );
}

const initial: AssetActionResult = null;

export function AssetDeleteForm({ assetId }: { assetId: string }) {
  const [state, formAction] = useFormState(deleteAsset, initial);
  return (
    <form action={formAction} className="space-y-2 border-t border-border pt-4">
      <input type="hidden" name="id" value={assetId} />
      <p className="text-xs text-muted-foreground">
        Le opportunità e le memorie collegate perderanno il riferimento all&apos;asset (campo svuotato).
      </p>
      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DelBtn />
    </form>
  );
}
