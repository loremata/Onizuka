"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ReferrerMagicLinkForm({ token }: { token: string }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-2 border-t border-dashed pt-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setMessage(null);
        try {
          const res = await fetch("/api/refer/magic-link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, email }),
          });
          const data = (await res.json()) as { message?: string; error?: string };
          setMessage(data.message ?? data.error ?? (res.ok ? "Richiesta inviata." : "Errore."));
        } catch {
          setMessage("Errore di rete.");
        } finally {
          setPending(false);
        }
      }}
    >
      <Label htmlFor="magic-email">Accesso senza PIN (magic link)</Label>
      <Input
        id="magic-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email registrata in agenzia"
        required
      />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Invio…" : "Invia link di accesso"}
      </Button>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </form>
  );
}
