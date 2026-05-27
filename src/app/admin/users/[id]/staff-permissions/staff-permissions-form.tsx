"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { StaffModuleChecklist } from "@/components/onizuka/staff-module-checklist";
import { StaffPermissionPresets } from "@/components/onizuka/staff-permission-presets";
import { ALL_STAFF_ACTIONS, STAFF_ACTION_LABELS } from "@/lib/staff-action-permissions";
import { updateStaffPermissions } from "./actions";

export function StaffPermissionsForm({
  userId,
  initialModules,
  initialDeniedActions = [],
  canApproveTimeEntries = false,
  timeApproverProjectCodes = [],
  timeApproverClientIds = [],
}: {
  userId: string;
  initialModules: string[];
  initialDeniedActions?: string[];
  canApproveTimeEntries?: boolean;
  timeApproverProjectCodes?: string[];
  timeApproverClientIds?: string[];
}) {
  const [pending, start] = useTransition();
  const selected = new Set(initialModules);
  const denied = new Set(initialDeniedActions);

  return (
    <form
      id={`staff-perms-page-${userId}`}
      className="space-y-4"
      action={(fd) => start(async () => { await updateStaffPermissions(userId, fd); })}
    >
      <StaffPermissionPresets formId={`staff-perms-page-${userId}`} />
      <StaffModuleChecklist selected={selected} disabled={pending} />
      <div className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-medium">Azioni vietate (deny-list)</p>
        <ul className="space-y-1 text-sm">
          {ALL_STAFF_ACTIONS.map((action) => (
            <li key={action}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="deniedActions"
                  value={action}
                  defaultChecked={denied.has(action)}
                  disabled={pending}
                />
                {STAFF_ACTION_LABELS[action]}
              </label>
            </li>
          ))}
        </ul>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="canApproveTimeEntries" defaultChecked={canApproveTimeEntries} />
        Può approvare ore (1ª firma time tracking)
      </label>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground" htmlFor="timeApproverProjectCodes">
          Commesse approvabili (projectCode, separate da virgola; vuoto = tutte)
        </label>
        <input
          id="timeApproverProjectCodes"
          name="timeApproverProjectCodes"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          defaultValue={timeApproverProjectCodes.join(", ")}
          placeholder="PROJ-A, PROJ-B"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground" htmlFor="timeApproverClientIds">
          Clienti approvabili (ID cliente, separati da virgola; vuoto = tutti)
        </label>
        <input
          id="timeApproverClientIds"
          name="timeApproverClientIds"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-mono text-xs"
          defaultValue={timeApproverClientIds.join(", ")}
          placeholder="clxxx..., clyyy..."
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Salvataggio…" : "Salva permessi"}
      </Button>
    </form>
  );
}
