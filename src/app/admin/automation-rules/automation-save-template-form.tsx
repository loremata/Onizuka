"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveAutomationRuleAsTemplate } from "./automation-template-actions";

export function AutomationSaveTemplateForm({ ruleId }: { ruleId: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="flex flex-wrap items-end gap-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const name = (fd.get("name") as string) ?? "";
        const shared = fd.get("shared") === "on";
        const marketplace = fd.get("marketplace") === "on";
        start(async () => {
          const res = await saveAutomationRuleAsTemplate(ruleId, name, shared, marketplace);
          setMessage("error" in res ? res.error ?? "Errore." : "Template salvato.");
        });
      }}
    >
      <Input name="name" placeholder="Nome template" className="h-8 w-48" required />
      <label className="flex items-center gap-1 text-xs">
        <input type="checkbox" name="shared" />
        Condividi team
      </label>
      <label className="flex items-center gap-1 text-xs">
        <input type="checkbox" name="marketplace" />
        Pubblica in marketplace
      </label>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Salva come template
      </Button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </form>
  );
}
