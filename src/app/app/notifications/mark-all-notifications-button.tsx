"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markAllNotificationsReadAction } from "./actions";

export function MarkAllNotificationsButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() => start(() => markAllNotificationsReadAction())}
    >
      {pending ? "…" : "Segna tutte lette"}
    </Button>
  );
}
