"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ReferrerPushOptIn({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!vapidPublicKey || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/referrer-sw.js").catch(() => {});
  }, [vapidPublicKey]);

  if (!vapidPublicKey) return null;

  return (
    <div className="border-t border-dashed pt-3 text-sm">
      <p className="text-xs text-muted-foreground mb-2">Notifiche push su liquidazioni e aggiornamenti.</p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={async () => {
          setStatus(null);
          try {
            const perm = await Notification.requestPermission();
            if (perm !== "granted") {
              setStatus("Permesso notifiche negato.");
              return;
            }
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
            });
            const json = sub.toJSON();
            const res = await fetch("/api/refer/push/subscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                endpoint: json.endpoint,
                keys: json.keys,
              }),
            });
            setStatus(res.ok ? "Notifiche push attivate." : "Errore registrazione.");
          } catch {
            setStatus("Push non supportato su questo browser.");
          }
        }}
      >
        Attiva notifiche push
      </Button>
      {status ? <p className="mt-1 text-xs text-muted-foreground">{status}</p> : null}
    </div>
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
