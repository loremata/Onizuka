"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function ClientPreviewButton({ clientId }: { clientId: string }) {
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
          const res = await fetch("/api/admin/impersonate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId }),
          });
          const data = (await res.json()) as { redirectUrl?: string; error?: string };
          if (!res.ok) {
            window.alert(data.error ?? "Anteprima non avviata.");
            return;
          }
          router.push(data.redirectUrl ?? "/app/dashboard");
        })
      }
    >
      {pending ? "…" : "Anteprima portale cliente"}
    </Button>
  );
}
