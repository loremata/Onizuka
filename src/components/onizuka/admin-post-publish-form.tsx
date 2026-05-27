"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Platform } from "@prisma/client";

type Props = {
  postId: string;
  publishedAt: Date | null;
  platform: Platform;
  nativePublishAvailable: boolean;
};

export function AdminPostPublishForm({
  postId,
  publishedAt,
  platform,
  nativePublishAvailable,
}: Props) {
  const router = useRouter();
  const [publishUrl, setPublishUrl] = useState("");
  const [impressions, setImpressions] = useState("");
  const [reach, setReach] = useState("");
  const [engagement, setEngagement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (publishedAt) {
    return (
      <p className="text-xs text-muted-foreground">
        Pubblicato il {publishedAt.toLocaleString("it-IT")}. Aggiorna metriche ripubblicando dal form sotto.
      </p>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/posts/${postId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publishUrl: publishUrl || undefined,
          impressions: impressions ? Number(impressions) : undefined,
          reach: reach ? Number(reach) : undefined,
          engagement: engagement ? Number(engagement) : undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Pubblicazione fallita");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
    } finally {
      setLoading(false);
    }
  }

  async function publishNative() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/posts/${postId}/publish-native`, { method: "POST" });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Publish nativo fallito");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 border-t pt-4">
      <p className="text-sm font-medium">Pubblica (Social Pro) · {platform}</p>
      {nativePublishAvailable ? (
        <Button type="button" size="sm" variant="secondary" disabled={loading} onClick={publishNative}>
          Pubblica su {platform === "LINKEDIN" ? "LinkedIn" : "Meta"} (API)
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          API nativa non configurata — usa segna pubblicato o n8n.
        </p>
      )}
      <Input placeholder="URL post live" value={publishUrl} onChange={(e) => setPublishUrl(e.target.value)} />
      <div className="grid grid-cols-3 gap-2">
        <Input placeholder="Impression" value={impressions} onChange={(e) => setImpressions(e.target.value)} />
        <Input placeholder="Reach" value={reach} onChange={(e) => setReach(e.target.value)} />
        <Input placeholder="Engagement" value={engagement} onChange={(e) => setEngagement(e.target.value)} />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" size="sm" disabled={loading}>
        Segna pubblicato + metriche
      </Button>
    </form>
  );
}
