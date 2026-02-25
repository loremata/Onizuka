"use client";

import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { setPostPending } from "./actions";

type Props = { postId: string };

export function AdminPostActions({ postId }: Props) {
  const [state, formAction] = useFormState(
    () => setPostPending(postId),
    null as { error: string } | null
  );

  return (
    <div className="border-t pt-4">
      <form action={formAction}>
        {state?.error && (
          <p className="mb-2 text-sm text-destructive">{state.error}</p>
        )}
        <Button type="submit" variant="outline" size="sm">
          Set back to Pending (after edits)
        </Button>
      </form>
    </div>
  );
}
