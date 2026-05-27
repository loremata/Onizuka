"use client";

import { useCallback } from "react";
import { Label } from "@/components/ui/label";
import { AUTOMATION_ACTION_TEMPLATES } from "@/lib/automation-templates-catalog";

/** Applica un modello dalla libreria ai campi template del form (per id DOM). */
export function AutomationRuleTemplatePicker() {
  const apply = useCallback((templateId: string) => {
    const tpl = AUTOMATION_ACTION_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    const sub = document.getElementById("emailSubjectTemplate") as HTMLInputElement | null;
    const body = document.getElementById("emailBodyTemplate") as HTMLTextAreaElement | null;
    const hook = document.getElementById("webhookPayloadTemplate") as HTMLTextAreaElement | null;
    if (sub) sub.value = tpl.emailSubjectTemplate;
    if (body) body.value = tpl.emailBodyTemplate;
    if (hook) hook.value = tpl.webhookPayloadTemplate;
  }, []);

  return (
    <div className="space-y-1 rounded-md border border-dashed border-border/80 bg-muted/30 p-2">
      <Label htmlFor="automation-template-lib" className="text-xs text-muted-foreground">
        Libreria template (email + webhook)
      </Label>
      <div className="flex flex-wrap gap-2">
        <select
          id="automation-template-lib"
          className="flex h-9 min-w-[200px] flex-1 rounded-md border border-input bg-background px-2 text-sm"
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            if (v) apply(v);
            e.target.selectedIndex = 0;
          }}
        >
          <option value="">— Scegli modello…</option>
          {AUTOMATION_ACTION_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>
      <p className="text-[11px] text-muted-foreground">
        I modelli compilano i tre campi sottostanti; puoi modificarli prima di salvare.
      </p>
    </div>
  );
}
