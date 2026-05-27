"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createClientCommitment,
  deleteClientCommitment,
  toggleCommitmentStatus,
  type CommitmentActionResult,
} from "./commitments/actions";

type CommitmentRow = {
  id: string;
  title: string;
  ownerName: string | null;
  note: string | null;
  dueDate: Date | null;
  status: string;
};

function SubmitCommitment() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "…" : "Aggiungi impegno"}
    </Button>
  );
}

export function ClientCommitmentsPanel({
  clientId,
  commitments,
}: {
  clientId: string;
  commitments: CommitmentRow[];
}) {
  const [state, action] = useFormState(
    (_p: CommitmentActionResult, fd: FormData) => createClientCommitment(clientId, _p, fd),
    null
  );
  const dateFmt = new Intl.DateTimeFormat("it-IT", { dateStyle: "short" });

  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <Input name="title" placeholder="Impegno / promessa" required className="w-48" />
        <Input name="ownerName" placeholder="Responsabile" className="w-32" />
        <Input name="dueDate" type="date" className="w-36" />
        <SubmitCommitment />
      </form>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      {commitments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessun impegno registrato.</p>
      ) : (
        <ul className="divide-y divide-border/60 text-sm">
          {commitments.map((c) => (
            <li key={c.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={c.status === "done" ? "font-medium line-through opacity-60" : "font-medium"}>
                  {c.title}
                  {c.ownerName ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">· {c.ownerName}</span>
                  ) : null}
                </p>
                {c.dueDate ? (
                  <p className="text-xs text-muted-foreground">Scadenza {dateFmt.format(c.dueDate)}</p>
                ) : null}
                {c.note ? <p className="text-xs text-muted-foreground">{c.note}</p> : null}
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => toggleCommitmentStatus(c.id, clientId)}
                >
                  {c.status === "done" ? "Riapri" : "Fatto"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteClientCommitment(c.id, clientId)}
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
