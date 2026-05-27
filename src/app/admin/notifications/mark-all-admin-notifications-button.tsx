"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markAllAdminNotificationsReadAction } from "./actions";

export function MarkAllAdminNotificationsButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() => start(() => markAllAdminNotificationsReadAction())}
    >
      {pending ? "…" : "Segna tutte lette"}
    </Button>
  );
}
