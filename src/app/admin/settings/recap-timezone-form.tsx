"use client";

import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { setRecapTimeZonePreference, type RecapTzActionResult } from "./actions";
import { Select } from "@/components/ui/select";

const initial: RecapTzActionResult = null;

type Opt = { value: string; label: string };

export function RecapTimezoneForm({ options, defaultValue }: { options: Opt[]; defaultValue: string }) {
  const [state, formAction] = useFormState(setRecapTimeZonePreference, initial);

  return (
    <form action={formAction} className="max-w-md space-y-3">
      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="timeZone">Fuso per «oggi» nel Command Center</Label>
        <Select
          id="timeZone"
          name="timeZone"
          defaultValue={defaultValue}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {options.map((o) => (
            <option key={o.value || "__auto__"} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit">Salva</Button>
    </form>
  );
}
