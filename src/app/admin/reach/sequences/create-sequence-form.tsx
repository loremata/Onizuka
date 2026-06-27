"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createOutreachSequence } from "../actions";
import { SequenceAbFields } from "./sequence-ab-fields";
import { Select } from "@/components/ui/select";

type ClientOption = { id: string; companyName: string };
type LeadOption = { id: string; label: string };

const PRESET_DELAYS = [0, 3, 7];

const PRESET_STEPS = [
  {
    delay: 0,
    subject: "Primo contatto",
    body: "Buongiorno,\n\n[testo step 1 — J+0]\n\nCordiali saluti,\nLorenzo",
  },
  {
    delay: 3,
    subject: "Follow-up",
    body: "Buongiorno,\n\nbreve follow-up sul messaggio precedente.\n\nCordiali saluti,\nLorenzo",
  },
  {
    delay: 7,
    subject: "Ultimo aggiornamento",
    body: "Buongiorno,\n\nultimo messaggio senza impegno.\n\nCordiali saluti,\nLorenzo",
  },
];

const CUSTOM_STEPS = [
  ...PRESET_STEPS,
  { delay: 14, subject: "", body: "" },
  { delay: 21, subject: "", body: "" },
];

function SequenceStepsEditor({
  steps,
  showDelays,
  pending,
}: {
  steps: typeof PRESET_STEPS;
  showDelays: boolean;
  pending: boolean;
}) {
  return (
    <div className="space-y-4 rounded-md border border-border/60 p-3">
      <p className="text-xs text-muted-foreground">
        {showDelays
          ? "Fino a 5 step. Giorni = offset da oggi (J+N)."
          : "Preset J+0, J+3, J+7 — personalizza testi e varianti B."}
      </p>
      {steps.map((s, i) => (
        <div key={i} className="grid gap-2 border-t border-border/40 pt-3 first:border-0 first:pt-0">
          <p className="text-xs font-medium">
            Step {i + 1}
            {!showDelays ? ` · J+${PRESET_DELAYS[i]}` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {showDelays ? (
              <Input
                name={`step_${i}_delay`}
                type="number"
                min={0}
                defaultValue={s.delay}
                className="w-20"
                placeholder="Giorni"
                disabled={pending}
              />
            ) : (
              <input type="hidden" name={`step_${i}_delay`} value={PRESET_DELAYS[i]} />
            )}
            <Input
              name={`step_${i}_subject`}
              defaultValue={s.subject}
              className="min-w-[200px] flex-1"
              disabled={pending}
            />
          </div>
          <textarea
            name={`step_${i}_body`}
            rows={4}
            defaultValue={s.body}
            disabled={pending}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <SequenceAbFields index={i} />
        </div>
      ))}
    </div>
  );
}

export function CreateSequenceForm({
  clients,
  leads,
}: {
  clients: ClientOption[];
  leads: LeadOption[];
}) {
  const [targetType, setTargetType] = useState<"client" | "lead">("client");
  const [sequenceMode, setSequenceMode] = useState<"preset" | "custom">("preset");
  const [state, action, pending] = useFormState(createOutreachSequence, null);

  return (
    <form action={action} className="space-y-4">
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="sequenceMode" value={sequenceMode} />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={targetType === "client" ? "default" : "outline"}
          onClick={() => setTargetType("client")}
        >
          Cliente
        </Button>
        <Button
          type="button"
          size="sm"
          variant={targetType === "lead" ? "default" : "outline"}
          onClick={() => setTargetType("lead")}
        >
          Lead
        </Button>
        <span className="mx-2 w-px bg-border" />
        <Button
          type="button"
          size="sm"
          variant={sequenceMode === "preset" ? "default" : "outline"}
          onClick={() => setSequenceMode("preset")}
        >
          Preset J+0/3/7
        </Button>
        <Button
          type="button"
          size="sm"
          variant={sequenceMode === "custom" ? "default" : "outline"}
          onClick={() => setSequenceMode("custom")}
        >
          Personalizzata
        </Button>
      </div>

      {targetType === "client" ? (
        <Select
          name="clientId"
          required
          className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
          disabled={pending}
        >
          <option value="">— Cliente —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </Select>
      ) : (
        <Select
          name="leadId"
          required
          className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
          disabled={pending}
        >
          <option value="">— Lead —</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </Select>
      )}

      <Input name="priorityProblem" placeholder="Focus commerciale (opzionale)" disabled={pending} />

      {sequenceMode === "preset" ? (
        <SequenceStepsEditor steps={PRESET_STEPS} showDelays={false} pending={pending} />
      ) : null}
      {sequenceMode === "custom" ? (
        <SequenceStepsEditor steps={CUSTOM_STEPS} showDelays pending={pending} />
      ) : null}

      <Button
        type="submit"
        size="sm"
        disabled={pending || (targetType === "client" ? clients.length === 0 : leads.length === 0)}
      >
        Avvia sequenza
      </Button>
    </form>
  );
}
