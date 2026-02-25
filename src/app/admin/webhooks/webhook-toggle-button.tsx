"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toggleWebhook } from "./actions";

type Props = { id: string; isActive: boolean };

export function WebhookToggleButton({ id, isActive }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => toggleWebhook(id))}
    >
      {pending ? "…" : isActive ? "Deactivate" : "Activate"}
    </Button>
  );
}
