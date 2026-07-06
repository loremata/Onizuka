"use client";

import { ITALY_TZ } from "@/lib/datetime-it";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { rotateDigitalAuditPublicLink } from "@/app/admin/audit/digital/actions";

type Draft = { id: string; status: string; subject: string; body: string };

type Props = {
  auditId: string;
  linkedInBody: string | null;
  callScript: string | null;
  whatsAppBody: string | null;
  whatsAppHref: string | null;
  publicReportUrl: string | null;
  publicExpiresAt: Date | null;
  drafts: Draft[];
  recipientEmail?: string | null;
};

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => {
            void navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copiato" : "Copia"}
        </Button>
      </div>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs">
        {text}
      </pre>
    </div>
  );
}

export function AuditOutreachKitPanel({
  auditId,
  linkedInBody,
  callScript,
  whatsAppBody,
  whatsAppHref,
  publicReportUrl,
  publicExpiresAt,
  drafts,
  recipientEmail,
}: Props) {
  const [reportUrl, setReportUrl] = useState(publicReportUrl);
  const [expires, setExpires] = useState(publicExpiresAt?.toISOString() ?? null);
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Outreach dall&apos;audit</CardTitle>
        <CardDescription>Email (Reach), WhatsApp, LinkedIn e script call — più report pubblico prospect.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {drafts.length > 0 ? (
          <div className="space-y-3">
            {drafts.map((d) => {
              const noEmail = !recipientEmail || /@onizuka\.local$/i.test(recipientEmail);
              return (
                <div key={d.id} className="space-y-2 rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{d.subject}</span>
                    <span className="text-xs text-muted-foreground">{d.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {noEmail
                      ? "⚠️ Senza email valida → contatta via WhatsApp/telefono"
                      : `Destinatario: ${recipientEmail}`}
                  </p>
                  <CopyBlock label="Corpo email" text={d.body} />
                  <Button asChild size="sm" className="h-8 text-xs">
                    <Link href={`/admin/reach?draft=${d.id}`}>Apri in Reach: approva e invia</Link>
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nessuna bozza email. Riesegui audit con outreach attivo.</p>
        )}

        {whatsAppBody ? (
          <div className="space-y-2">
            <CopyBlock label="WhatsApp" text={whatsAppBody} />
            {whatsAppHref ? (
              <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                <a href={whatsAppHref} target="_blank" rel="noreferrer">
                  Apri WhatsApp col messaggio
                </a>
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Aggiungi il numero del titolare alla scheda per abilitare l&apos;invio WhatsApp.
              </p>
            )}
          </div>
        ) : null}
        {linkedInBody ? <CopyBlock label="LinkedIn" text={linkedInBody} /> : null}
        {callScript ? <CopyBlock label="Script call" text={callScript} /> : null}

        <div className="rounded-md border p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Report pubblico (token)</p>
          {reportUrl ? (
            <p className="break-all text-sm">
              <a href={reportUrl} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                {reportUrl}
              </a>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Link non ancora generato.</p>
          )}
          {expires ? (
            <p className="text-xs text-muted-foreground">
              Scade: {new Date(expires).toLocaleString("it-IT", { timeZone: ITALY_TZ })}
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await rotateDigitalAuditPublicLink(auditId);
                if ("error" in res) return;
                setReportUrl(res.url);
                setExpires(res.expiresAt);
              })
            }
          >
            {reportUrl ? "Rigenera link" : "Genera link report"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
