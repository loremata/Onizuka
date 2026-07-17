"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { regenerateInsights } from "./actions";

type StoredReport = {
  aiGenerated: boolean;
  model: string | null;
  narrative: string;
  lenses: { key: string; role: string; text: string }[];
  generatedAt: string; // ISO
} | null;

type Props = { clientId: string; report: StoredReport };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Il team sta analizzando…" : "Rigenera analisi del team"}
    </Button>
  );
}

export function AiNarrative({ clientId, report }: Props) {
  const [state, action] = useFormState(
    (_: unknown, fd: FormData) => regenerateInsights(clientId, _, fd),
    null as { ok: true; aiGenerated: boolean } | { error: string } | null
  );

  return (
    <div className="space-y-4">
      <form action={action}>
        <SubmitButton />
        {state && "error" in state && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
      </form>

      {report ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {report.aiGenerated ? `Team AI${report.model ? ` · ${report.model}` : ""}` : "Sintesi automatica (AI non configurata)"} ·
            aggiornato il {new Date(report.generatedAt).toLocaleString("it-IT")}
          </p>
          <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">{report.narrative}</div>

          {report.lenses.length > 0 && (
            <details className="rounded-md border">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                Pareri del team ({report.lenses.length} esperti)
              </summary>
              <div className="space-y-3 px-3 pb-3">
                {report.lenses.map((l) => (
                  <div key={l.key}>
                    <p className="text-sm font-semibold">{l.role}</p>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{l.text}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nessuna analisi salvata: generala col pulsante (o attendi il refresh automatico).
        </p>
      )}
    </div>
  );
}
