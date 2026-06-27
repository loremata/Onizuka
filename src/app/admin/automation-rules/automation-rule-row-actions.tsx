"use client";

import type { AutomationRuleTrigger } from "@prisma/client";
import Link from "next/link";
import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { simulationPayloadPresetsForTrigger } from "@/lib/automation-simulation-presets";
import { deleteAutomationRule, duplicateAutomationRule, simulateAutomationRule, toggleAutomationRule } from "./actions";
import { AutomationSimWizard } from "./automation-sim-wizard";
import { Select } from "@/components/ui/select";

export function AutomationRuleRowActions({
  id,
  name,
  enabled,
  trigger,
}: {
  id: string;
  name: string;
  enabled: boolean;
  trigger: AutomationRuleTrigger;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const presetRef = useRef<HTMLSelectElement>(null);
  const presets = simulationPayloadPresetsForTrigger(trigger);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        ref={presetRef}
        className="h-8 max-w-[200px] rounded-md border border-input bg-background px-2 text-xs"
        defaultValue={presets[0]?.id}
        aria-label="Preset simulazione"
      >
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await toggleAutomationRule(id, !enabled);
          })
        }
      >
        {enabled ? "Disattiva" : "Attiva"}
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link href={`/admin/automation-rules/${id}/edit`}>Modifica</Link>
      </Button>
      <Button asChild size="sm" variant="ghost">
        <a href={`/api/admin/automation-rules/${id}/export`} target="_blank" rel="noreferrer">
          JSON
        </a>
      </Button>
      <AutomationSimWizard ruleId={id} trigger={trigger} ruleName={name} />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const sel = presetRef.current?.value;
            const chosen = presets.find((p) => p.id === sel);
            let custom = "";
            if (!chosen || chosen.json === "__CUSTOM__") {
              custom =
                prompt(
                  "JSON payload opzionale per simulazione (es. {\"platform\":\"INSTAGRAM\",\"amountEur\":320}):",
                  ""
                ) ?? "";
            } else {
              custom = chosen.json;
            }
            const res = await simulateAutomationRule(id, custom);
            if ("error" in res) alert(res.error);
            else {
              const preview = [
                res.note,
                res.rendered?.subject ? `Subject: ${res.rendered.subject}` : "",
                res.rendered?.webhook ? `Webhook: ${res.rendered.webhook.slice(0, 200)}` : "",
              ]
                .filter(Boolean)
                .join("\n");
              alert(preview);
            }
          })
        }
      >
        Simula
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await duplicateAutomationRule(id);
            if (res?.error) window.alert(res.error);
            else router.refresh();
          })
        }
      >
        Duplica
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-destructive"
        disabled={pending}
        onClick={() => {
          if (confirm("Eliminare questa regola?")) {
            start(async () => {
              await deleteAutomationRule(id);
            });
          }
        }}
      >
        Elimina
      </Button>
    </div>
  );
}
