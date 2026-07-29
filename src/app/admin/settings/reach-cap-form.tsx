"use client";

import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyReachDailyCap, type ReachCapActionResult } from "./actions";

const initial: ReachCapActionResult = null;

export function ReachCapForm({
  currentCap,
  suggestedCap,
  action,
}: {
  currentCap: number;
  suggestedCap: number | null;
  action: string;
}) {
  const [state, formAction] = useFormState(applyReachDailyCap, initial);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {state && "error" in state ? (
        <p className="w-full text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state && "ok" in state ? (
        <p className="w-full text-sm text-muted-foreground" role="status">
          Tetto impostato a {state.cap} invii al giorno.
        </p>
      ) : null}

      <label className="space-y-1">
        <span className="block text-xs text-muted-foreground">Invii automatici al giorno</span>
        <Input
          name="cap"
          type="number"
          min={1}
          max={500}
          defaultValue={suggestedCap ?? currentCap}
          className="w-28"
        />
      </label>

      <Button type="submit" variant={action === "raise" ? "default" : "secondary"} size="sm">
        {suggestedCap && suggestedCap > currentCap
          ? `Alza a ${suggestedCap}`
          : suggestedCap && suggestedCap < currentCap
            ? `Abbassa a ${suggestedCap}`
            : "Applica"}
      </Button>
    </form>
  );
}
