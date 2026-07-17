"use client";

import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createGa4Connection } from "./actions";

type Props = { clients: { id: string; companyName: string; isOwnBrand: boolean }[] };

export function Ga4ConnectionForm({ clients }: Props) {
  const [state, action] = useFormState(
    (_: unknown, fd: FormData) => createGa4Connection(_, fd),
    null as { error: string } | null
  );

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {state?.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2">{state.error}</div>
      )}
      <div className="space-y-2">
        <Label htmlFor="clientId">Cliente / brand</Label>
        <Select
          id="clientId"
          name="clientId"
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Seleziona…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
              {c.isOwnBrand ? " ⭐" : ""}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="displayName">Nome (es. sito Online Station)</Label>
        <Input id="displayName" name="displayName" required placeholder="Sito principale" />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="externalId">ID property GA4</Label>
        <Input id="externalId" name="externalId" required placeholder="123456789" />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm">Collega property</Button>
      </div>
    </form>
  );
}
