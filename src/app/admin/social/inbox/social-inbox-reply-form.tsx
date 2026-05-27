"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { replySocialInboxComment } from "./actions";

export function SocialInboxReplyForm({ commentId }: { commentId: string }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mt-2 space-y-2">
      <textarea
        className="min-h-[60px] w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
        placeholder="Risposta pubblica via API…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={pending}
      />
      <Button
        type="button"
        size="sm"
        disabled={pending || !text.trim()}
        onClick={() => {
          setErr(null);
          start(async () => {
            const res = await replySocialInboxComment(commentId, text);
            if ("error" in res) setErr(res.error);
            else setText("");
          });
        }}
      >
        Invia risposta API
      </Button>
      {err ? <p className="text-xs text-destructive">{err}</p> : null}
    </div>
  );
}
