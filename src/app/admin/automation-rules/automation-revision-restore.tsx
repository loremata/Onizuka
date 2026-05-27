"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { restoreAutomationRuleRevision } from "./actions";

export function AutomationRevisionRestore({
  ruleId,
  version,
}: {
  ruleId: string;
  version: number;
}) {
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-7 text-xs"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Ripristinare la configurazione alla revisione v${version}?`)) return;
        start(async () => {
          await restoreAutomationRuleRevision(ruleId, version);
        });
      }}
    >
      Ripristina
    </Button>
  );
}
