"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markOneNotificationRead } from "./actions";

export function NotificationRowActions({
  notificationId,
  isRead,
}: {
  notificationId: string;
  isRead: boolean;
}) {
  const [pending, start] = useTransition();
  if (isRead) return <span className="text-xs text-muted-foreground">Letta</span>;

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-7 text-xs"
      disabled={pending}
      onClick={() => start(() => markOneNotificationRead(notificationId))}
    >
      {pending ? "…" : "Segna letta"}
    </Button>
  );
}
