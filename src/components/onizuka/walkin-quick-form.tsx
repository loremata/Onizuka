"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WalkinQuickForm() {
  const searchParams = useSearchParams();
  const refToken = searchParams.get("ref") ?? "";

  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/public/walkin/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: fd.get("displayName"),
        phone: fd.get("phone"),
        vatNumber: fd.get("vatNumber") || undefined,
        need: fd.get("need") || undefined,
        nextStep: fd.get("nextStep") || undefined,
        refToken: refToken || undefined,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? "Errore di invio");
      return;
    }
    setDone(true);
    e.currentTarget.reset();
  }

  if (done) {
    return (
      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-6 text-center text-sm">
        <p className="font-medium text-foreground">Grazie!</p>
        <p className="mt-2 text-muted-foreground">La richiesta è stata registrata. Ti contatteremo a breve.</p>
        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setDone(false)}>
          Nuova registrazione
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="displayName">Nome / attività *</Label>
        <Input id="displayName" name="displayName" required placeholder="Es. Studio Rossi" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Telefono *</Label>
        <Input id="phone" name="phone" type="tel" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="vatNumber">Partita IVA (opzionale)</Label>
        <Input id="vatNumber" name="vatNumber" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="need">Di cosa hai bisogno?</Label>
        <textarea
          id="need"
          name="need"
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nextStep">Quando possiamo richiamarti?</Label>
        <Input id="nextStep" name="nextStep" placeholder="Es. domani mattina" />
      </div>
      {refToken ? (
        <p className="text-xs text-muted-foreground">Segnalazione collegata al referente.</p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Invio…" : "Invia richiesta"}
      </Button>
    </form>
  );
}
