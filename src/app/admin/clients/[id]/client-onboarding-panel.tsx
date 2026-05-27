"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createOnboardingItem,
  deleteOnboardingItem,
  toggleOnboardingItem,
  type OnboardingActionResult,
} from "./onboarding/actions";

type OnboardingRow = {
  id: string;
  label: string;
  status: string;
  dueDate: Date | null;
  completedAt: Date | null;
};

function SubmitOnboarding() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "…" : "Aggiungi voce"}
    </Button>
  );
}

export function ClientOnboardingPanel({
  clientId,
  items,
}: {
  clientId: string;
  items: OnboardingRow[];
}) {
  const [state, action] = useFormState(
    (_p: OnboardingActionResult, fd: FormData) => createOnboardingItem(clientId, _p, fd),
    null
  );
  const done = items.filter((i) => i.status === "done").length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Avanzamento onboarding: {done}/{items.length} ({pct}%)
      </p>
      <form action={action} className="flex flex-wrap items-end gap-2">
        <Input name="label" placeholder="Nuova voce checklist" required className="w-56" />
        <SubmitOnboarding />
      </form>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Checklist non inizializzata.</p>
      ) : (
        <ul className="divide-y divide-border/60 text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 py-2">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.status === "done"}
                  onChange={() => toggleOnboardingItem(item.id, clientId)}
                />
                <span className={item.status === "done" ? "line-through opacity-60" : ""}>
                  {item.label}
                </span>
              </label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => deleteOnboardingItem(item.id, clientId)}
              >
                Elimina
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
