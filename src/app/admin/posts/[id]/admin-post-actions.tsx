"use client";

import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { AdminPostPublishForm } from "@/components/onizuka/admin-post-publish-form";
import { releasePostForClientReview, setPostPending } from "./actions";

import type { Platform } from "@prisma/client";

type Props = {
  postId: string;
  awaitingClientReview: boolean;
  publishedAt: Date | null;
  platform: Platform;
  nativePublishAvailable: boolean;
};

export function AdminPostActions({
  postId,
  awaitingClientReview,
  publishedAt,
  platform,
  nativePublishAvailable,
}: Props) {
  const [pendingState, pendingAction] = useFormState(
    () => setPostPending(postId),
    null as { error: string } | null
  );
  const [releaseState, releaseAction] = useFormState(
    () => releasePostForClientReview(postId),
    null as { error: string } | null
  );

  return (
    <div className="space-y-4 border-t pt-4">
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
