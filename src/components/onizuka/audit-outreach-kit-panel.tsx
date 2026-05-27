"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { rotateDigitalAuditPublicLink } from "@/app/admin/audit/digital/actions";

type Draft = { id: string; status: string; subject: string };

type Props = {
  auditId: string;
  linkedInBody: string | null;
  callScript: string | null;
  publicReportUrl: string | null;
  publicExpiresAt: Date | null;
  drafts: Draft[];
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
  publicReportUrl,
  publicExpiresAt,
  drafts,
}: Props) {
  const [reportUrl, setReportUrl] = useState(publicReportUrl);
  const [expires, setExpires] = useState(publicExpiresAt?.toISOString() ?? null);
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Outreach dall&apos;audit</CardTitle>
        <CardDescription>Email (Reach), LinkedIn e script call — più report pubblico prospect.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {drafts.length > 0 ? (
          <ul className="text-sm">
            {drafts.map((d) => (
              <li key={d.id}>
                <Link className="text-primary hover:underline" href={`/admin/reach?draft=${d.id}`}>
                  {d.subject}
                </Link>
                <span className="ml-2 text-xs text-muted-foreground">{d.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nessuna bozza email. Riesegui audit con outreach attivo.</p>
        )}

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
              Scade: {new Date(expires).toLocaleString("it-IT")}
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
