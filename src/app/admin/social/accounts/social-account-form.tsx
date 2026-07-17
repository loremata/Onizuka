"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createSocialAccount } from "./actions";

type Props = { clients: { id: string; companyName: string; slug: string; isOwnBrand: boolean }[] };

const ID_HELP: Record<string, string> = {
  FACEBOOK: "ID della Pagina Facebook (es. 1234567890).",
  INSTAGRAM: "ID della Pagina Facebook collegata all'account IG business.",
  LINKEDIN: "URN autore, es. urn:li:organization:12345.",
  GBP: "Nome location, es. accounts/123/locations/456.",
};

export function SocialAccountForm({ clients }: Props) {
  const [state, formAction] = useFormState(
    (_: unknown, fd: FormData) => createSocialAccount(_, fd),
    null as { error: string } | null
  );
  const [platform, setPlatform] = useState("FACEBOOK");

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
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
                {c.isOwnBrand ? " ⭐ (brand proprio)" : ""} ({c.slug})
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="platform">Piattaforma</Label>
          <Select
            id="platform"
            name="platform"
            required
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="FACEBOOK">Facebook</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="LINKEDIN">LinkedIn</option>
            <option value="GBP">Google Business Profile</option>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="displayName">Nome visualizzato</Label>
        <Input id="displayName" name="displayName" required placeholder="Es. TIM Fastweb Rosignano" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="externalAccountId">ID account</Label>
        <Input id="externalAccountId" name="externalAccountId" required placeholder="ID / URN / location" />
        <p className="text-xs text-muted-foreground">{ID_HELP[platform]}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="accessToken">Token di accesso</Label>
        <Input
          id="accessToken"
          name="accessToken"
          type="password"
          required
          placeholder="Token pagina/account (verrà cifrato)"
        />
        <p className="text-xs text-muted-foreground">
          Salvato cifrato (AES-256-GCM). Modalità <strong>MANAGED</strong>: sei tu admin del Business Manager.
        </p>
      </div>
      <Button type="submit">Collega account</Button>
    </form>
  );
}
