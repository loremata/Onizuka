"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { replyGbpReviewAction } from "./gbp-reviews-actions";

export function GbpReviewReplyForm({
  clientId,
  reviewId,
  assetId,
}: {
  clientId: string;
  reviewId: string;
  assetId?: string;
}) {
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="mt-2 space-y-1"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await replyGbpReviewAction(clientId, reviewId, text, assetId);
          setMessage(res.ok ? (res.note ? `Audit: ${res.note}` : "Registrato in audit.") : res.error);
          if (res.ok) setText("");
        });
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Bozza risposta (audit trail)"
        className="flex w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
        disabled={pending}
      />
      <Button type="submit" size="sm" variant="outline" className="h-7 text-xs" disabled={pending || !text.trim()}>
        Salva risposta
      </Button>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </form>
  );
}
