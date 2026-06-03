"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  cancelOutreachSequence,
  pauseOutreachSequence,
  resumeOutreachSequence,
  markSequenceReplied,
} from "../actions";

export function SequenceRowActions({
  sequenceId,
  status,
}: {
  sequenceId: string;
  status: string;
}) {
  const [pending, start] = useTransition();

  if (status !== "ACTIVE" && status !== "PAUSED") return null;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        title="Ferma la sequenza e promuovi il prospect a opportunità"
        onClick={() => start(async () => { await markSequenceReplied(sequenceId); })}
      >
        Ha risposto
      </Button>
      {status === "ACTIVE" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => start(async () => { await pauseOutreachSequence(sequenceId); })}
        >
          Pausa
        </Button>
      ) : null}
      {status === "PAUSED" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => start(async () => { await resumeOutreachSequence(sequenceId); })}
        >
          Riprendi
        </Button>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => start(async () => { await cancelOutreachSequence(sequenceId); })}
      >
        Annulla
      </Button>
    </div>
  );
}
