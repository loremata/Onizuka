"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "../../actions";

type Props = { userId: string };

export function ResetPasswordForm({ userId }: Props) {
  const [state, formAction] = useFormState(
    (_: unknown, fd: FormData) => resetPassword(userId, _, fd),
    null as { error: string } | null
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="password">Nuova password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="Almeno 8 caratteri"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit">Aggiorna password</Button>
        <Button asChild type="button" variant="outline">
          <Link href="/admin/users">Annulla</Link>
        </Button>
      </div>
    </form>
  );
}
