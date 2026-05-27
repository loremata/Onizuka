"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createRuleFromTemplate } from "./automation-template-actions";

export function AutomationTemplateUseButton({ templateId }: { templateId: string }) {
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await createRuleFromTemplate(templateId);
          if ("error" in res) alert(res.error);
        })
      }
    >
      {pending ? "…" : "Usa template"}
    </Button>
  );
}
