"use client";

import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";

export type NotifyDigestActionResult = { error: string } | null;

type Props = {
  defaultEnabled: boolean;
  action: (
    prev: NotifyDigestActionResult,
    formData: FormData
  ) => Promise<NotifyDigestActionResult>;
};

export function NotifyDigestForm({ defaultEnabled, action }: Props) {
  const [state, formAction, pending] = useFormState(action, null as NotifyDigestActionResult);

  return (
    <form action={formAction} className="space-y-3">
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="notifyDigestEmail"
          value="1"
          defaultChecked={defaultEnabled}
          className="mt-1"
        />
        <span>
          Ricevi digest email delle notifiche non lette (cron giornaliero e pulsante manuale). Richiede SMTP
          configurato.
        </span>
      </label>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Salvataggio…" : "Salva preferenza digest"}
      </Button>
    </form>
  );
}
