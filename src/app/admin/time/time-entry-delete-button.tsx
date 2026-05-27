"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteTimeEntry } from "./actions";

export function TimeEntryDeleteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-destructive hover:text-destructive"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await deleteTimeEntry(id);
        })
      }
    >
      Elimina
    </Button>
  );
}
