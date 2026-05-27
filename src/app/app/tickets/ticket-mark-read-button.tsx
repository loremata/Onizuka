"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markTicketRead } from "./actions";

export function TicketMarkReadButton({ ticketId }: { ticketId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-7 text-xs"
      disabled={pending}
      onClick={() => start(() => markTicketRead(ticketId))}
    >
      {pending ? "…" : "Segna come letto"}
    </Button>
  );
}
