"use client";

import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { approvePost, requestChanges } from "../../actions";

type Props = { postId: string };

export function PostActions({ postId }: Props) {
  const [approveState, approveAction] = useFormState(
    (_: unknown, fd: FormData) => approvePost(postId, _, fd),
    null as { error: string } | null
  );
  const [requestState, requestAction] = useFormState(
    (_: unknown, fd: FormData) => requestChanges(postId, _, fd),
    null as { error: string } | null
  );

  const error = approveState?.error ?? requestState?.error;

  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-sm font-medium">Actions</p>
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <form action={approveAction} className="space-y-2 rounded-lg border p-4">
          <Label>Approve this post</Label>
          <p className="text-xs text-muted-foreground">Optionally add a comment.</p>
          <textarea
            name="comment"
            rows={2}
            placeholder="Optional comment..."
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[60px]"
          />
          <Button type="submit" className="w-full sm:w-auto">
            Approve
          </Button>
        </form>

        <form action={requestAction} className="space-y-2 rounded-lg border p-4">
          <Label>Request changes</Label>
          <p className="text-xs text-muted-foreground">Comment is required so we know what to change.</p>
          <textarea
            name="comment"
            rows={2}
            required
            placeholder="Describe what you’d like changed..."
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[60px]"
          />
          <Button type="submit" variant="outline" className="w-full sm:w-auto">
            Request changes
          </Button>
        </form>
      </div>
    </div>
  );
}
