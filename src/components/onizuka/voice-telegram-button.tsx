"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  recapText: string;
  telegramConfigured: boolean;
};

export function VoiceTelegramButton({ recapText, telegramConfigured }: Props) {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function send() {
    if (!telegramConfigured) return;
    setStatus("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/voice/send-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: recapText }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; recipients?: number };
      if (!res.ok) {
        setStatus("error");
        setMessage(json.error ?? "Invio fallito");
        return;
      }
      setStatus("ok");
      setMessage(`Inviato a ${json.recipients ?? 0} chat admin`);
    } catch {
      setStatus("error");
      setMessage("Errore di rete");
    }
  }

  if (!telegramConfigured) {
    return (
      <p className="text-xs text-muted-foreground">
        Telegram: configura <span className="font-mono">TELEGRAM_BOT_TOKEN</span> e{" "}
        <span className="font-mono">TELEGRAM_ADMIN_CHAT_IDS</span> su Vercel.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={status === "sending"}
        onClick={send}
      >
        {status === "sending" ? "Invio…" : "Invia recap su Telegram"}
      </Button>
      {message ? (
        <span className={`text-xs ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {message}
        </span>
      ) : null}
    </div>
  );
}
