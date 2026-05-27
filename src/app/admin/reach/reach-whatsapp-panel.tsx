"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Inbound = { id: string; phoneFrom: string; body: string | null; receivedAt: string };

export function ReachWhatsAppPanel() {
  const [messages, setMessages] = useState<Inbound[]>([]);
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/reach/whatsapp-inbox")
      .then(async (res) => (res.ok ? res.json() : { messages: [] }))
      .then((d: { messages: Inbound[] }) => setMessages(d.messages ?? []))
      .catch(() => {});
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">WhatsApp · inbox Reach</CardTitle>
        <CardDescription>Rispondi ai messaggi in ingresso dal webhook Meta.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {messages.length === 0 ? (
          <p className="text-muted-foreground">Nessun messaggio in inbox.</p>
        ) : (
          <ul className="max-h-40 divide-y overflow-y-auto">
            {messages.map((m) => (
              <li key={m.id} className="py-1">
                <button
                  type="button"
                  className="w-full text-left hover:bg-muted/50 rounded px-1"
                  onClick={() => {
                    setTo(m.phoneFrom);
                    setBody("");
                  }}
                >
                  <span className="font-medium">+{m.phoneFrom}</span>
                  <span className="block text-xs text-muted-foreground line-clamp-1">{m.body ?? "—"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex flex-col gap-2 border-t pt-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setStatus(null);
            const res = await fetch("/api/integrations/whatsapp/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ to, body }),
            });
            const data = (await res.json()) as { error?: string };
            setStatus(res.ok ? "Inviato." : data.error ?? "Errore.");
          }}
        >
          <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Destinatario E.164" required />
          <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Risposta" required />
          <Button type="submit" size="sm">
            Invia da Reach
          </Button>
        </form>
        {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
      </CardContent>
    </Card>
  );
}
