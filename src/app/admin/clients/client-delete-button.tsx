"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Props = { clientId: string; companyName: string };

export function ClientDeleteButton({ clientId, companyName }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to delete client.");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      alert("Failed to delete client.");
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Delete &quot;{companyName}&quot;?</span>
        <Button variant="destructive" size="sm" onClick={handleDelete} disabled={loading}>
          {loading ? "Deleting…" : "Yes"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={loading}>
          No
        </Button>
      </div>
    );
  }

  return (
    <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>
      Delete
    </Button>
  );
}
