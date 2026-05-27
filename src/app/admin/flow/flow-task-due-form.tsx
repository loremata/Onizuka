"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updateFlowTaskDueDate, type FlowActionResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={pending}>
      {pending ? "…" : "Salva"}
    </Button>
  );
}

const initialState: FlowActionResult = null;

function toDatetimeLocalValue(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function FlowTaskDueForm({
  taskId,
  dueDate,
}: {
  taskId: string;
  dueDate: Date | null;
}) {
  const bound = (prev: FlowActionResult, formData: FormData) =>
    updateFlowTaskDueDate(taskId, prev, formData);

  const [state, formAction] = useFormState(bound, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-1">
      {state?.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
      <div className="flex items-center gap-1">
        <Input
          name="dueDate"
          type="datetime-local"
          defaultValue={toDatetimeLocalValue(dueDate)}
          className="h-8 w-[min(100%,11rem)] text-xs"
        />
        <SubmitButton />
      </div>
    </form>
  );
}
