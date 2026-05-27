"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markSocialCommentReplied } from "./actions";

export function SocialInboxReplyButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => start(() => markSocialCommentReplied(id))}>
      Segna risposto
    </Button>
  );
}
