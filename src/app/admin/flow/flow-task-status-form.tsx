"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { FlowTaskStatus } from "@prisma/client";
import { updateFlowTaskStatus, type FlowActionResult } from "./actions";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? "…" : "Aggiorna"}
    </Button>
  );
}

const initialState: FlowActionResult = null;

const options: { value: FlowTaskStatus; label: string }[] = [
  { value: "TODO", label: "Da fare" },
  { value: "IN_PROGRESS", label: "In corso" },
  { value: "WAITING", label: "In attesa" },
  { value: "DONE", label: "Completato" },
  { value: "CANCELLED", label: "Annullato" },
];

export function FlowTaskStatusForm({
  taskId,
  current,
}: {
  taskId: string;
  current: FlowTaskStatus;
}) {
  const boundUpdate = (prev: FlowActionResult, formData: FormData) =>
    updateFlowTaskStatus(taskId, prev, formData);

  const [state, formAction] = useFormState(boundUpdate, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      {state?.error && <span className="w-full text-xs text-destructive">{state.error}</span>}
      <select
        name="status"
        defaultValue={current}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <SubmitButton />
    </form>
  );
}
