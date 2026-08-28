"use client";

import { useEffect, useState } from "react";

type StatusPayload = {
  googleCalendar: boolean;
  gmail: boolean;
  gmailSmtp: boolean;
  telegram: boolean;
  pagespeed: boolean;
  voiceTts: string | null;
  n8n: boolean;
  storage: string;
  cron: boolean;
  upstashLoginRateLimit: boolean;
  redisApiRateLimit: boolean;
  whatsapp: boolean;
  /** Mittente reale delle mail di outreach (GMAIL_SMTP_FROM, o l'utente SMTP). */
  outreachFrom: string | null;
  /** Casella che il watcher IMAP legge per risposte e rimbalzi. */
  outreachInbox: string | null;
  /** Le risposte tornano al mittente: se le due caselle differiscono, nessuno le legge. */
  outreachReplyMismatch: boolean;
};

const labels: Record<
  Exclude<keyof StatusPayload, "outreachFrom" | "outreachInbox" | "outreachReplyMismatch">,
  string
> = {
  googleCalendar: "Google Calendar",
  gmail: "Gmail OAuth",
  gmailSmtp: "Gmail SMTP (Reach)",
  telegram: "Telegram",
  pagespeed: "Google PageSpeed (audit)",
  voiceTts: "TTS provider",
  n8n: "n8n API",
  storage: "Storage media",
  cron: "Cron notifiche",
  upstashLoginRateLimit: "Upstash (login)",
  redisApiRateLimit: "Redis API",
  whatsapp: "WhatsApp Cloud",
};

export function IntegrationsStatus() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/integrations/status")
      .then(async (res) => {
        if (!res.ok) throw new Error("status");
        return res.json() as Promise<StatusPayload>;
      })
      .then(setData)
      .catch(() => setError("Impossibile caricare lo stato integrazioni"));
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Caricamento…</p>;

  return (
    <div className="space-y-3">
      {/* Gli indirizzi dell'outreach: su Vercel le variabili sono "sensitive" e non
          si rileggono più, ma il mittente sta in cima a ogni mail che parte. */}
      <div className="rounded-md border border-border/60 p-3 text-sm">
        <p className="font-medium">Posta dell&apos;outreach</p>
        <p className="mt-1 text-muted-foreground">
          Le mail partono da <strong className="text-foreground">{data.outreachFrom ?? "— non configurato —"}</strong>
          {" · "}le risposte vengono lette da{" "}
          <strong className="text-foreground">{data.outreachInbox ?? "— non configurata —"}</strong>
        </p>
        {data.outreachReplyMismatch ? (
          <p className="mt-2 text-destructive">
            I due indirizzi non coincidono: chi risponde scrive al mittente, ma il controllo delle
            risposte guarda l&apos;altra casella. Così lo stop dei follow-up non scatterebbe mai.
          </p>
        ) : null}
      </div>

      <ul className="space-y-3 text-sm">
      {(Object.keys(labels) as (keyof typeof labels)[]).map((key) => {
        const val = data[key];
        const configured =
          key === "voiceTts"
            ? Boolean(val)
            : key === "storage"
              ? val !== "none"
              : Boolean(val);
        const label =
          key === "voiceTts"
            ? val
              ? String(val)
              : "Non configurato (Web Speech nel browser)"
            : key === "storage"
              ? val === "s3"
                ? "S3/R2 attivo"
                : val === "local"
                  ? "Filesystem locale (VPS)"
                  : "Non configurato"
              : key === "gmailSmtp"
                ? configured
                  ? "Attivo · invio da Reach"
                  : "Non configurato (usa mailto)"
                : configured
                  ? key === "googleCalendar" || key === "gmail"
                    ? "Configurato · collega da Impostazioni"
                    : "Attivo"
                  : "Non configurato";
        return (
          <li
            key={key}
            className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border/60 p-3"
          >
            <span className="font-medium">{labels[key]}</span>
            <span className={configured ? "text-foreground" : "text-muted-foreground"}>{label}</span>
          </li>
        );
      })}
      </ul>
    </div>
  );
}
