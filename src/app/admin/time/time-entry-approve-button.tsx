"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { approveTimeEntry, type TimeEntryResult } from "./actions";

export function TimeEntryApproveButton({ entryId, label = "Approva" }: { entryId: string; label?: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r: TimeEntryResult = await approveTimeEntry(entryId);
          if (r?.error) window.alert(r.error);
          else router.refresh();
        })
      }
    >
      {pending ? "…" : label}
    </Button>
  );
}
