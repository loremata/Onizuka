"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateFinanceEntryRenewalDate } from "./actions";

export function FinanceRenewalDateButton({
  entryId,
  renewalDate,
}: {
  entryId: string;
  renewalDate: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const defaultVal = renewalDate ? renewalDate.slice(0, 10) : "";

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Rinnovo {renewalDate ? "✓" : "—"}
      </Button>
    );
  }

  return (
    <form
      className="flex flex-wrap items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const v = (new FormData(e.currentTarget).get("renewalDate") as string) ?? "";
        start(async () => {
          await updateFinanceEntryRenewalDate(entryId, v);
          setOpen(false);
        });
      }}
    >
      <Input name="renewalDate" type="date" className="h-8 w-36 text-xs" defaultValue={defaultVal} />
      <Button type="submit" size="sm" disabled={pending}>
        OK
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        ×
      </Button>
    </form>
  );
}
