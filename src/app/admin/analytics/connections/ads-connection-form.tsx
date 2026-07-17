"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createAdsConnection } from "./actions";

type Props = { clients: { id: string; companyName: string; isOwnBrand: boolean }[] };

const ID_HELP: Record<string, string> = {
  META_ADS: "ID ad account Meta, es. act_1234567890.",
  GOOGLE_ADS: "ID cliente Google Ads (10 cifre), es. 1234567890.",
};

export function AdsConnectionForm({ clients }: Props) {
  const [state, action] = useFormState(
    (_: unknown, fd: FormData) => createAdsConnection(_, fd),
    null as { error: string } | null
  );
  const [source, setSource] = useState("META_ADS");

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {state?.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2">{state.error}</div>
      )}
      <div className="space-y-2">
        <Label htmlFor="ads-source">Piattaforma</Label>
        <Select
          id="ads-source"
          name="source"
          required
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="META_ADS">Meta Ads</option>
          <option value="GOOGLE_ADS">Google Ads</option>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ads-client">Cliente / brand</Label>
        <Select
          id="ads-client"
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
        <Label htmlFor="ads-name">Nome</Label>
        <Input id="ads-name" name="displayName" required placeholder="Es. campagne negozio" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ads-id">ID account</Label>
        <Input id="ads-id" name="externalId" required placeholder="act_… / 1234567890" />
        <p className="text-xs text-muted-foreground">{ID_HELP[source]}</p>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="ads-token">Token di accesso</Label>
        <Input id="ads-token" name="accessToken" type="password" required placeholder="Token (verrà cifrato)" />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm">Collega account</Button>
      </div>
    </form>
  );
}
