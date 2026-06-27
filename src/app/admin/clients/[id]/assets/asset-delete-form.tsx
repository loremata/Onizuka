"use client";

import { useFormState } from "react-dom";
import { ConfirmSubmitButton } from "@/components/onizuka/confirm-submit-button";
import { deleteAsset, type AssetActionResult } from "./actions";

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
      <ConfirmSubmitButton label="Elimina asset" question="Eliminare questo asset?" />
    </form>
  );
}
