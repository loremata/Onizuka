"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ClientPreviewBanner({ companyName }: { companyName: string }) {
  const router = useRouter();

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm">
      <span>
        Anteprima portale cliente: <strong>{companyName}</strong> — ticket, upload, approvazione e revisione post (audit).
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={async () => {
          await fetch("/api/admin/impersonate", { method: "DELETE" });
          router.push("/admin/clients");
          router.refresh();
        }}
      >
        Esci anteprima
      </Button>
    </div>
  );
}
