"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { StaffModuleChecklist } from "@/components/onizuka/staff-module-checklist";
import { StaffPermissionPresets } from "@/components/onizuka/staff-permission-presets";
import { updateStaffPermissionsInline } from "./staff-actions";

export function StaffPermissionsInline({
  userId,
  initialModules,
}: {
  userId: string;
  initialModules: string[];
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const selected = new Set(initialModules);

  return (
    <div className="text-left">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Chiudi permessi" : "Modifica permessi"}
      </Button>
      {open ? (
        <form
          id={`staff-perms-${userId}`}
          className="mt-2 min-w-[280px] rounded-md border border-border bg-muted/30 p-3"
          action={(fd) =>
            start(async () => {
              const res = await updateStaffPermissionsInline(userId, fd);
              setMessage(res.ok ? "Salvato." : res.error);
              if (res.ok) setOpen(false);
            })
          }
        >
          <StaffPermissionPresets formId={`staff-perms-${userId}`} />
          <StaffModuleChecklist selected={selected} disabled={pending} compact />
          <div className="mt-2 flex items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "…" : "Salva"}
            </Button>
            {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
