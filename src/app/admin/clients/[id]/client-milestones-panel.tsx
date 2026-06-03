"use client";

import { dateTimeFormatIt } from "@/lib/datetime-it";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createClientMilestone,
  deleteClientMilestone,
  toggleMilestoneComplete,
  type MilestoneActionResult,
} from "./milestones/actions";

type MilestoneRow = {
  id: string;
  title: string;
  description: string | null;
  targetDate: Date | null;
  completedAt: Date | null;
  visibleToClient: boolean;
};

function SubmitMilestone() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "…" : "Aggiungi milestone"}
    </Button>
  );
}

export function ClientMilestonesPanel({
  clientId,
  milestones,
}: {
  clientId: string;
  milestones: MilestoneRow[];
}) {
  const [state, action] = useFormState(
    (_p: MilestoneActionResult, fd: FormData) => createClientMilestone(clientId, _p, fd),
    null
  );
  const dateFmt = dateTimeFormatIt({ dateStyle: "short" });

  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <Input name="title" placeholder="Titolo milestone" required className="w-48" />
        <Input name="targetDate" type="date" className="w-36" />
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" name="visibleToClient" defaultChecked />
          Visibile al cliente
        </label>
        <SubmitMilestone />
      </form>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      {milestones.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessuna milestone. Il cliente le vedrà in Progetti.</p>
      ) : (
        <ul className="divide-y divide-border/60 text-sm">
          {milestones.map((m) => (
            <li key={m.id} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={m.completedAt ? "font-medium line-through opacity-60" : "font-medium"}>
                  {m.title}
                  {!m.visibleToClient ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">(solo admin)</span>
                  ) : null}
                </p>
                {m.targetDate ? (
                  <p className="text-xs text-muted-foreground">Target {dateFmt.format(m.targetDate)}</p>
                ) : null}
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => toggleMilestoneComplete(m.id, clientId)}
                >
                  {m.completedAt ? "Riapri" : "Completa"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteClientMilestone(m.id, clientId)}
                >
                  Elimina
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
