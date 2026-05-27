"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function WhatsAppIntegrationCard({ configured }: { configured: boolean }) {
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateParam, setTemplateParam] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-4 rounded-md border border-border/60 p-3 text-sm">
      <p className="text-muted-foreground">
        WhatsApp Business Cloud API —{" "}
        <span className={configured ? "text-green-600 dark:text-green-400" : "text-amber-600"}>
          {configured ? "token configurato" : "non configurato"}
        </span>
        . Webhook: <span className="font-mono text-xs">/api/integrations/whatsapp/webhook</span>
      </p>
      {configured ? (
        <>
          <form
            className="flex flex-col gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              setMessage(null);
              try {
                const res = await fetch("/api/integrations/whatsapp/send", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ to, body }),
                });
                const data = (await res.json()) as { error?: string; ok?: boolean };
                setMessage(res.ok ? "Messaggio inviato." : data.error ?? "Errore invio.");
              } catch {
                setMessage("Errore di rete.");
              } finally {
                setPending(false);
              }
            }}
          >
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="Destinatario E.164 (es. 393331234567)"
              required
            />
            <Input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Testo messaggio (sessione)"
              required
            />
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Invio…" : "Invia testo libero"}
            </Button>
          </form>
          <form
            className="flex flex-col gap-2 border-t border-dashed pt-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              setMessage(null);
              try {
                const res = await fetch("/api/integrations/whatsapp/template", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    to,
                    templateName,
                    bodyParameters: templateParam ? [templateParam] : [],
                  }),
                });
                const data = (await res.json()) as { error?: string };
                setMessage(res.ok ? "Template HSM inviato." : data.error ?? "Errore template.");
              } catch {
                setMessage("Errore di rete.");
              } finally {
                setPending(false);
              }
            }}
          >
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Nome template HSM (Meta)"
              required
            />
            <Input
              value={templateParam}
              onChange={(e) => setTemplateParam(e.target.value)}
              placeholder="Parametro body {{1}} (opzionale)"
            />
            <Button type="submit" size="sm" variant="secondary" disabled={pending}>
              Invia template HSM
            </Button>
          </form>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Imposta <span className="font-mono">WHATSAPP_ACCESS_TOKEN</span> e{" "}
          <span className="font-mono">WHATSAPP_PHONE_NUMBER_ID</span> su Vercel.
        </p>
      )}
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
