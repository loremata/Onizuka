"use client";

import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { addCompetitor } from "./actions";

type Props = { clientId: string };

export function CompetitorForm({ clientId }: Props) {
  const [state, action] = useFormState(
    (_: unknown, fd: FormData) => addCompetitor(_, fd),
    null as { error: string } | null
  );

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="clientId" value={clientId} />
      {state?.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2">{state.error}</div>
      )}
      <div className="space-y-2">
        <Label htmlFor="cmp-platform">Piattaforma</Label>
        <Select
          id="cmp-platform"
          name="platform"
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="INSTAGRAM">Instagram</option>
          <option value="FACEBOOK">Facebook</option>
          <option value="LINKEDIN">LinkedIn</option>
          <option value="TIKTOK">TikTok</option>
          <option value="YOUTUBE">YouTube</option>
          <option value="GBP">Google Business</option>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cmp-name">Nome competitor</Label>
        <Input id="cmp-name" name="name" required placeholder="Es. Negozio concorrente" />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="cmp-handle">Handle / profilo (opzionale)</Label>
        <Input id="cmp-handle" name="handle" placeholder="@profilo o URL" />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm">Aggiungi competitor</Button>
      </div>
    </form>
  );
}
