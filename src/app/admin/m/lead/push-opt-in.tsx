"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";

type State = "sconosciuto" | "attive" | "spente" | "negato" | "non-supportato";

/**
 * Attivazione delle push, messa qui e non nelle impostazioni: e' la pagina dei
 * contatti in arrivo, cioe' il posto dove uno capisce a cosa servono.
 *
 * Su iOS il permesso si puo' chiedere SOLO se l'app e' stata aggiunta alla
 * home: da Safari la chiamata fallisce e basta. Per questo lo diciamo invece
 * di mostrare un pulsante che non funziona.
 */
export function PushOptIn({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [state, setState] = useState<State>("sconosciuto");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!vapidPublicKey) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("non-supportato");
      return;
    }
    void (async () => {
      try {
        await navigator.serviceWorker.register("/admin-sw.js");
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (Notification.permission === "denied") setState("negato");
        else setState(sub ? "attive" : "spente");
      } catch {
        setState("non-supportato");
      }
    })();
  }, [vapidPublicKey]);

  // Senza chiavi VAPID la funzione e' spenta lato server: non mostrare nulla e'
  // meglio di un pulsante che non potrebbe funzionare.
  if (!vapidPublicKey || state === "sconosciuto") return null;

  if (state === "non-supportato") {
    return (
      <Row icon={<BellOff className="h-4 w-4" aria-hidden />}>
        Notifiche non supportate qui. Su iPhone funzionano solo dopo
        &ldquo;Aggiungi a Home&rdquo;.
      </Row>
    );
  }

  if (state === "negato") {
    return (
      <Row icon={<BellOff className="h-4 w-4" aria-hidden />}>
        Notifiche bloccate. Vanno riattivate dalle impostazioni del browser.
      </Row>
    );
  }

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState("negato");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!) as BufferSource,
      });
      const json = sub.toJSON();
      const res = await fetch("/api/admin/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setState(res.ok ? "attive" : "spente");
    } catch {
      setState("non-supportato");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/admin/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("spente");
    } catch {
      /* lo stato resta com'era */
    } finally {
      setBusy(false);
    }
  }

  const attive = state === "attive";

  return (
    <button
      type="button"
      onClick={attive ? disable : enable}
      disabled={busy}
      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border bg-card px-3 text-sm disabled:opacity-60"
    >
      <span className="flex items-center gap-2">
        {attive ? (
          <BellRing className="h-4 w-4 text-primary" aria-hidden />
        ) : (
          <Bell className="h-4 w-4 text-muted-foreground" aria-hidden />
        )}
        {attive ? "Notifiche attive su questo telefono" : "Avvisami quando entra un contatto"}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {busy ? "…" : attive ? "disattiva" : "attiva"}
      </span>
    </button>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
      <span className="mt-0.5 shrink-0">{icon}</span>
      {children}
    </p>
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
