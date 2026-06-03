"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateOutreachDraft } from "@/app/admin/reach/actions";

type Props = {
  draftId: string;
  subject: string;
  body: string;
  subjectAlt?: string | null;
  bodyAlt?: string | null;
  editable: boolean;
};

const textareaClass =
  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function ApprovalOutreachPreview({
  draftId,
  subject,
  body,
  subjectAlt,
  bodyAlt,
  editable,
}: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [s, setS] = useState(subject);
  const [b, setB] = useState(body);
  const [sa, setSa] = useState(subjectAlt ?? "");
  const [ba, setBa] = useState(bodyAlt ?? "");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
      >
        Anteprima email
      </button>
    );
  }

  return (
    <div className="mt-2 w-full rounded-md border border-border/70 bg-background/60 p-3 text-sm">
      {!editing ? (
        <div className="space-y-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Oggetto
            </p>
            <p className="font-medium">{subject}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Corpo
            </p>
            <p className="whitespace-pre-wrap text-muted-foreground">{body}</p>
          </div>
          {subjectAlt || bodyAlt ? (
            <div className="rounded bg-muted/40 p-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Variante B (A/B)
              </p>
              {subjectAlt ? <p className="font-medium">{subjectAlt}</p> : null}
              {bodyAlt ? (
                <p className="whitespace-pre-wrap text-muted-foreground">{bodyAlt}</p>
              ) : null}
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Chiudi
            </Button>
            {editable ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
                Modifica
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Oggetto
            </label>
            <Input value={s} onChange={(e) => setS(e.target.value)} disabled={pending} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Corpo
            </label>
            <textarea
              value={b}
              onChange={(e) => setB(e.target.value)}
              disabled={pending}
              rows={9}
              className={textareaClass}
            />
          </div>
          <details>
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Variante B (A/B, opzionale)
            </summary>
            <div className="mt-2 space-y-1">
              <Input
                value={sa}
                onChange={(e) => setSa(e.target.value)}
                disabled={pending}
                placeholder="Oggetto B"
              />
              <textarea
                value={ba}
                onChange={(e) => setBa(e.target.value)}
                disabled={pending}
                rows={4}
                className={textareaClass}
                placeholder="Corpo B"
              />
            </div>
          </details>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const res = await updateOutreachDraft(draftId, {
                    subject: s,
                    body: b,
                    subjectAlt: sa || null,
                    bodyAlt: ba || null,
                  });
                  if (res?.error) setError(res.error);
                  else setEditing(false);
                })
              }
            >
              {pending ? "Salvataggio…" : "Salva modifiche"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setEditing(false);
                setError(null);
                setS(subject);
                setB(body);
                setSa(subjectAlt ?? "");
                setBa(bodyAlt ?? "");
              }}
            >
              Annulla
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
