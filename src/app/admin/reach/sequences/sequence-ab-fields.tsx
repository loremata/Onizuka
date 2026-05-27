"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SequenceAbFields({
  index,
  defaultSubjectAlt = "",
  defaultBodyAlt = "",
  fieldMode = "create",
}: {
  index: number;
  defaultSubjectAlt?: string;
  defaultBodyAlt?: string;
  /** create: step_N_* ; edit: subjectAlt / bodyAlt */
  fieldMode?: "create" | "edit";
}) {
  const [open, setOpen] = useState(Boolean(defaultSubjectAlt || defaultBodyAlt));
  const subjectName = fieldMode === "edit" ? "subjectAlt" : `step_${index}_subjectAlt`;
  const bodyName = fieldMode === "edit" ? "bodyAlt" : `step_${index}_bodyAlt`;

  return (
    <div className="space-y-2">
      <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen((v) => !v)}>
        {open ? "Nascondi variante B" : "+ Variante B (A/B test)"}
      </Button>
      {open ? (
        <div className="grid gap-2 rounded-md border border-dashed border-primary/30 bg-primary/5 p-2">
          <Input
            name={subjectName}
            defaultValue={defaultSubjectAlt}
            placeholder="Oggetto B (opzionale)"
            className="text-sm"
          />
          <textarea
            name={bodyName}
            rows={3}
            defaultValue={defaultBodyAlt}
            placeholder="Corpo B (opzionale)"
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          />
        </div>
      ) : null}
    </div>
  );
}
