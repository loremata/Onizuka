"use client";

import Link from "next/link";
import { useMemo } from "react";
import { askIntentLabel } from "@/lib/ask-onizuka";
import { orchestrateAsk } from "@/lib/ask-orchestration";

type Props = {
  query: string;
};

export function CommandIntentHint({ query }: Props) {
  const plan = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return null;
    return orchestrateAsk(q);
  }, [query]);

  if (!plan) return null;

  const primaryLabel = askIntentLabel(plan.primary);

  return (
    <div className="container mx-auto space-y-1 px-4 pb-2 text-xs text-muted-foreground" aria-live="polite">
      <p>
        Anteprima: <span className="text-foreground">→ {primaryLabel}</span>
        <span className="ml-2 hidden sm:inline">· {plan.summary}</span>
      </p>
      {plan.followUps.length > 0 ? (
        <p className="flex flex-wrap gap-x-3 gap-y-1">
          <span>Prossimi passi:</span>
          {plan.followUps.map((f) => (
            <Link key={f.href} href={f.href} className="text-primary hover:underline">
              {f.label}
            </Link>
          ))}
        </p>
      ) : null}
    </div>
  );
}
