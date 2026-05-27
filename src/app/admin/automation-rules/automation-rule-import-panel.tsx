"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { importAutomationRuleFromJson } from "./actions";

export function AutomationRuleImportPanel() {
  const [json, setJson] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-2 rounded-md border border-dashed border-border/80 p-3 text-sm">
      <p className="font-medium">Importa regola da JSON</p>
      <p className="text-xs text-muted-foreground">
        Incolla l&apos;export da <code className="text-xs">GET /api/admin/automation-rules/[id]/export</code> (campo{" "}
        <code className="text-xs">rule</code>). La regola viene creata <strong>disattivata</strong>.
      </p>
      <textarea
        className="min-h-[100px] w-full rounded-md border border-input bg-muted/30 p-2 font-mono text-xs"
        value={json}
        onChange={(e) => setJson(e.target.value)}
        spellCheck={false}
        placeholder='{"rule":{"name":"…","trigger":"LEAD_CREATED",…}}'
      />
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending || !json.trim()}
        onClick={() =>
          start(async () => {
            const res = await importAutomationRuleFromJson(json);
            if ("error" in res) setMessage(res.error);
            else {
              setMessage("Regola importata.");
              setJson("");
            }
          })
        }
      >
        {pending ? "…" : "Importa"}
      </Button>
    </div>
  );
}
