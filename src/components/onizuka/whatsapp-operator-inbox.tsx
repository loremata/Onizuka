"use client";

import { dateTimeFormatIt } from "@/lib/datetime-it";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assignWhatsAppMessage, replyWhatsAppInbound } from "@/app/admin/whatsapp/actions";
import { Select } from "@/components/ui/select";

export type WhatsAppInboxRow = {
  id: string;
  phoneFrom: string;
  body: string | null;
  receivedAt: string;
  repliedAt: string | null;
  assignedUserId: string | null;
  assigneeName: string | null;
  phoneLineLabel?: string | null;
};

export function WhatsAppOperatorInbox({
  messages,
  staffUsers,
  templates,
}: {
  messages: WhatsAppInboxRow[];
  staffUsers: { id: string; name: string | null; email: string }[];
  templates: { id: string; name: string; bodyPreview: string }[];
}) {
  const [pending, start] = useTransition();
  const [replyBody, setReplyBody] = useState<Record<string, string>>({});
  const [templatePick, setTemplatePick] = useState<Record<string, string>>({});

  const fmt = dateTimeFormatIt({ dateStyle: "short", timeStyle: "short" });

  return (
    <ul className="divide-y text-sm">
      {messages.length === 0 ? (
        <li className="py-4 text-muted-foreground">Nessun messaggio in ingresso.</li>
      ) : (
        messages.map((m) => (
          <li key={m.id} className="space-y-2 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                +{m.phoneFrom}
                {m.phoneLineLabel ? (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{m.phoneLineLabel}</span>
                ) : null}
              </p>
              <span className="text-xs text-muted-foreground">{fmt.format(new Date(m.receivedAt))}</span>
            </div>
            <p className="line-clamp-4">{m.body ?? "—"}</p>
            {m.repliedAt ? (
              <p className="text-xs text-green-700 dark:text-green-400">
                Risposto {fmt.format(new Date(m.repliedAt))}
                {m.assigneeName ? ` · ${m.assigneeName}` : ""}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Label className="sr-only">Assegna</Label>
              <Select
                className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                value={m.assignedUserId ?? ""}
                disabled={pending}
                onChange={(e) => {
                  const uid = e.target.value || null;
                  start(async () => {
                    await assignWhatsAppMessage(m.id, uid);
                  });
                }}
              >
                <option value="">— Non assegnato —</option>
                {staffUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name ?? u.email}
                  </option>
                ))}
              </Select>
            </div>
            {!m.repliedAt ? (
              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <div className="space-y-1">
                  <Label htmlFor={`tpl-${m.id}`}>Template HSM (opz.)</Label>
                  <Select
                    id={`tpl-${m.id}`}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                    value={templatePick[m.id] ?? ""}
                    onChange={(e) => setTemplatePick((prev) => ({ ...prev, [m.id]: e.target.value }))}
                  >
                    <option value="">Messaggio libero</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Input
                  placeholder="Testo risposta…"
                  value={replyBody[m.id] ?? ""}
                  onChange={(e) => setReplyBody((prev) => ({ ...prev, [m.id]: e.target.value }))}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    start(async () => {
                      const err = await replyWhatsAppInbound({
                        messageId: m.id,
                        body: replyBody[m.id] ?? "",
                        templateName: templatePick[m.id] || undefined,
                      });
                      if (err?.error) alert(err.error);
                    });
                  }}
                >
                  Invia risposta
                </Button>
              </div>
            ) : null}
          </li>
        ))
      )}
    </ul>
  );
}
