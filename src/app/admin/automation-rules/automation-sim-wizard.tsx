"use client";

import type { AutomationRuleTrigger } from "@prisma/client";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  defaultSimulationVarsForTrigger,
  simulationPayloadPresetsForTrigger,
} from "@/lib/automation-simulation-presets";
import { simulateAutomationRule } from "./actions";
import { Select } from "@/components/ui/select";

type Step = 1 | 2 | 3;

export function AutomationSimWizard({
  ruleId,
  trigger,
  ruleName,
}: {
  ruleId: string;
  trigger: AutomationRuleTrigger;
  ruleName: string;
}) {
  const presets = useMemo(() => simulationPayloadPresetsForTrigger(trigger), [trigger]);
  const defaults = useMemo(() => defaultSimulationVarsForTrigger(trigger), [trigger]);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [presetId, setPresetId] = useState(presets[0]?.id ?? "empty");
  const [jsonText, setJsonText] = useState("");
  const [resultText, setResultText] = useState("");
  const [pending, start] = useTransition();

  const chosenPreset = presets.find((p) => p.id === presetId);

  function reset() {
    setStep(1);
    setPresetId(presets[0]?.id ?? "empty");
    setJsonText("");
    setResultText("");
  }

  function openWizard() {
    reset();
    setOpen(true);
  }

  function goStep2() {
    const preset = presets.find((p) => p.id === presetId);
    if (preset?.json && preset.json !== "__CUSTOM__" && preset.json !== "") {
      setJsonText(preset.json);
    } else {
      setJsonText("{}");
    }
    setStep(2);
  }

  function mergedPreview(): string {
    let overlay: Record<string, unknown> = {};
    try {
      overlay = jsonText.trim() ? (JSON.parse(jsonText) as Record<string, unknown>) : {};
    } catch {
      return "JSON non valido";
    }
    return JSON.stringify({ ...defaults, ...overlay }, null, 2);
  }

  return (
    <>
      <Button type="button" size="sm" variant="secondary" onClick={openWizard}>
        Wizard sim
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sim-wizard-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg border bg-background p-5 shadow-lg">
            <h2 id="sim-wizard-title" className="text-lg font-semibold">
              Simulazione regola
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {ruleName} · <code className="text-xs">{trigger}</code> — passo {step}/3
            </p>

            {step === 1 && (
              <div className="mt-4 space-y-3 text-sm">
                <p className="text-muted-foreground">Scegli uno scenario di test per il payload evento.</p>
                <Select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={presetId}
                  onChange={(e) => setPresetId(e.target.value)}
                >
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
                {chosenPreset?.json === "__CUSTOM__" && (
                  <p className="text-xs text-muted-foreground">
                    Al passo 2 potrai incollare JSON personalizzato.
                  </p>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="mt-4 space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Modifica il payload (merge con variabili default del trigger).
                </p>
                <textarea
                  className="min-h-[140px] w-full rounded-md border border-input bg-muted/30 p-2 font-mono text-xs"
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  spellCheck={false}
                />
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Anteprima merge</p>
                  <pre className="max-h-32 overflow-auto rounded-md bg-muted/50 p-2 text-xs">{mergedPreview()}</pre>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="mt-4 space-y-2 text-sm">
                <p className="font-medium">Esito simulazione</p>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs">
                  {resultText || "—"}
                </pre>
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Annulla
              </Button>
              {step > 1 && step < 3 && (
                <Button type="button" variant="outline" disabled={pending} onClick={() => setStep((step - 1) as Step)}>
                  Indietro
                </Button>
              )}
              {step === 1 && (
                <Button type="button" onClick={goStep2}>
                  Avanti
                </Button>
              )}
              {step === 2 && (
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      try {
                        JSON.parse(jsonText.trim() || "{}");
                      } catch {
                        setResultText("Errore: JSON non valido.");
                        setStep(3);
                        return;
                      }
                      const res = await simulateAutomationRule(ruleId, jsonText.trim());
                      if ("error" in res) {
                        setResultText(res.error);
                      } else {
                        const lines = [
                          res.note,
                          res.rendered?.subject ? `Subject: ${res.rendered.subject}` : "",
                          res.rendered?.body ? `Body: ${String(res.rendered.body).slice(0, 400)}` : "",
                          res.rendered?.webhook ? `Webhook: ${res.rendered.webhook.slice(0, 300)}` : "",
                        ].filter(Boolean);
                        setResultText(lines.join("\n\n"));
                      }
                      setStep(3);
                    })
                  }
                >
                  {pending ? "Esecuzione…" : "Esegui simulazione"}
                </Button>
              )}
              {step === 3 && (
                <Button type="button" onClick={() => setOpen(false)}>
                  Chiudi
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
