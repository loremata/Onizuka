"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSocialInboxComment } from "./actions";
import { Select } from "@/components/ui/select";

export function SocialInboxCommentForm({
  clients,
}: {
  clients: { id: string; companyName: string }[];
}) {
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-2 sm:grid-cols-2"
      action={(fd) => start(async () => { await createSocialInboxComment(fd); })}
    >
      <Select name="platform" className="h-10 rounded-md border border-input bg-background px-2 text-sm" required>
        <option value="INSTAGRAM">Instagram</option>
        <option value="FACEBOOK">Facebook</option>
        <option value="LINKEDIN">LinkedIn</option>
        <option value="GBP">Google Business</option>
      </Select>
      <Select name="clientId" className="h-10 rounded-md border border-input bg-background px-2 text-sm">
        <option value="">Cliente (opzionale)</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.companyName}
          </option>
        ))}
      </Select>
      <Input name="authorName" placeholder="Autore commento" />
      <Input name="externalUrl" type="url" placeholder="URL post" />
      <textarea
        name="body"
        rows={3}
        required
        className="sm:col-span-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        placeholder="Testo commento"
      />
      <Button type="submit" size="sm" disabled={pending} className="sm:col-span-2 w-fit">
        Aggiungi a inbox
      </Button>
    </form>
  );
}
