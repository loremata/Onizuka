"use client";

import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { AdminPostPublishForm } from "@/components/onizuka/admin-post-publish-form";
import { releasePostForClientReview, setPostPending, setPostSocialAccount } from "./actions";

import type { Platform } from "@prisma/client";

type Props = {
  postId: string;
  awaitingClientReview: boolean;
  publishedAt: Date | null;
  platform: Platform;
  nativePublishAvailable: boolean;
  socialAccountId: string | null;
  socialAccounts: { id: string; displayName: string }[];
};

export function AdminPostActions({
  postId,
  awaitingClientReview,
  publishedAt,
  platform,
  nativePublishAvailable,
  socialAccountId,
  socialAccounts,
}: Props) {
  const [pendingState, pendingAction] = useFormState(
    () => setPostPending(postId),
    null as { error: string } | null
  );
  const [releaseState, releaseAction] = useFormState(
    () => releasePostForClientReview(postId),
    null as { error: string } | null
  );
  const [accountState, accountAction] = useFormState(
    (_: unknown, fd: FormData) => setPostSocialAccount(postId, _, fd),
    null as { error: string } | { ok: true } | null
  );

  return (
    <div className="space-y-4 border-t pt-4">
      <form action={accountAction} className="space-y-1">
        <p className="text-sm font-medium">Account di pubblicazione (scheduler)</p>
        <div className="flex items-center gap-2">
          <Select
            name="socialAccountId"
            defaultValue={socialAccountId ?? ""}
            className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Nessuno (flusso legacy / n8n)</option>
            {socialAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName}
              </option>
            ))}
          </Select>
          <Button type="submit" size="sm" variant="outline">
            Salva
          </Button>
        </div>
        {accountState && "error" in accountState ? (
          <p className="text-sm text-destructive">{accountState.error}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Se impostato, il post viene pubblicato automaticamente all&apos;orario programmato (una volta approvato dal cliente).
          {socialAccounts.length === 0 ? " Nessun account collegato per questo cliente/piattaforma." : ""}
        </p>
      </form>

      {!awaitingClientReview ? (
        <form action={releaseAction}>
          {releaseState?.error ? (
            <p className="mb-2 text-sm text-destructive">{releaseState.error}</p>
          ) : null}
          <Button type="submit" size="sm">
            Invia al cliente per approvazione
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">
            Materiale caricato dal cliente: dopo la revisione interna, rilascia per l&apos;approvazione finale.
          </p>
        </form>
      ) : null}
      <form action={pendingAction}>
        {pendingState?.error ? <p className="mb-2 text-sm text-destructive">{pendingState.error}</p> : null}
        <Button type="submit" variant="outline" size="sm">
          Rimetti in attesa (dopo modifiche)
        </Button>
      </form>
      <AdminPostPublishForm
        postId={postId}
        publishedAt={publishedAt}
        platform={platform}
        nativePublishAvailable={nativePublishAvailable}
      />
    </div>
  );
}
