"use client";

import { useTransition } from "react";
import { deleteFlowTask } from "./actions";
import { Button } from "@/components/ui/button";

export function FlowTaskDeleteButton({ taskId, title }: { taskId: string; title: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-7 text-xs text-destructive hover:text-destructive"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Eliminare il task «${title}»?`)) return;
        startTransition(async () => {
          const err = await deleteFlowTask(taskId);
          if (err?.error) alert(err.error);
        });
      }}
    >
      {pending ? "…" : "Elimina"}
    </Button>
  );
}
