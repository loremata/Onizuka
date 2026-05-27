"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateSequenceStep } from "./actions";
import { SequenceAbFields } from "../sequence-ab-fields";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "…" : "Salva step"}
    </Button>
  );
}

export function SequenceStepForm({
  stepId,
  delayDays,
  subject,
  body,
  subjectAlt,
  bodyAlt,
}: {
  stepId: string;
  delayDays: number;
  subject: string;
  body: string;
  subjectAlt?: string | null;
  bodyAlt?: string | null;
}) {
  const [state, action] = useFormState(
    (_p: { error: string } | null, fd: FormData) => updateSequenceStep(stepId, _p, fd),
    null as { error: string } | null
  );

  return (
    <form action={action} className="mt-2 space-y-2 rounded border border-border/50 p-2">
      {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Input name="delayDays" type="number" min={0} defaultValue={delayDays} className="w-20" />
        <Input name="subject" defaultValue={subject} className="min-w-[200px] flex-1" />
      </div>
      <textarea
        name="body"
        rows={3}
        defaultValue={body}
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
      />
      <SequenceAbFields
        index={0}
        fieldMode="edit"
        defaultSubjectAlt={subjectAlt ?? ""}
        defaultBodyAlt={bodyAlt ?? ""}
      />
      <Submit />
    </form>
  );
}
