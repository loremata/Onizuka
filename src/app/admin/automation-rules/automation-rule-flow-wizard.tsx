"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const STEPS = [
  { title: "Trigger", hint: "Scegli l'evento (POST_APPROVED, LEAD_CREATED, …) e priorità." },
  { title: "Condizione", hint: "Usa il builder preset o key/operator/value per filtrare." },
  { title: "Azioni", hint: "Telegram, email SMTP, webhook, task Flow, retry." },
  { title: "Rivedi", hint: "Attiva la regola e invia con «Aggiungi regola»." },
] as const;

/** Checklist visuale a step sopra il form creazione regola. */
export function AutomationRuleFlowWizard() {
  const [step, setStep] = useState(0);
  const current = STEPS[step]!;

  return (
    <div className="mb-4 space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
      <div className="flex flex-wrap gap-1">
        {STEPS.map((s, i) => (
          <button
            key={s.title}
            type="button"
            onClick={() => setStep(i)}
            className={`rounded-md px-2 py-1 text-xs ${
              i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {i + 1}. {s.title}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        <strong>{current.title}:</strong> {current.hint}
      </p>
      <div className="flex gap-2">
        {step > 0 ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setStep(step - 1)}>
            Indietro
          </Button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button type="button" size="sm" onClick={() => setStep(step + 1)}>
            Avanti
          </Button>
        ) : null}
      </div>
    </div>
  );
}
