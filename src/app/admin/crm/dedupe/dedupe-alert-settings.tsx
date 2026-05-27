"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateDedupeAlertThreshold } from "./dedupe-actions";

export function DedupeAlertSettings({ initialMinGroups }: { initialMinGroups: number | null }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="flex flex-wrap items-end gap-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await updateDedupeAlertThreshold(fd);
          setMessage(res.ok ? "Soglia salvata." : res.error);
        });
      }}
    >
      <div>
        <label className="text-xs text-muted-foreground" htmlFor="dedupeAlertMinGroups">
          Email alert scan: min. gruppi (vuoto = env)
        </label>
        <Input
          id="dedupeAlertMinGroups"
          name="dedupeAlertMinGroups"
          type="number"
          min={1}
          max={999}
          className="mt-1 h-9 w-24"
          defaultValue={initialMinGroups ?? ""}
          placeholder="3"
        />
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Salva soglia
      </Button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </form>
  );
}
