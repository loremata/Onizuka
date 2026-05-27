"use client";

import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PasswordActionResult } from "@/lib/account-password";

type Props = {
  action: (
    prev: PasswordActionResult,
    formData: FormData
  ) => Promise<PasswordActionResult>;
  required?: boolean;
};

export function ChangePasswordForm({ action, required }: Props) {
  const [state, formAction] = useFormState(action, null);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      {required ? (
        <p className="text-sm text-amber-600">
          Per sicurezza devi impostare una nuova password prima di continuare.
        </p>
      ) : null}
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <div className="space-y-2">
        <label htmlFor="currentPassword" className="text-sm font-medium">
          Password attuale
        </label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <div className="space-y-2">
        <label htmlFor="newPassword" className="text-sm font-medium">
          Nuova password
        </label>
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium">
          Conferma nuova password
        </label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <Button type="submit">Salva password</Button>
    </form>
  );
}
