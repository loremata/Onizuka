"use client";

import { useTransition } from "react";
import { switchWorkspace } from "@/app/admin/settings/workspace-actions";

export function WorkspaceSwitcherClient({
  workspaces,
  activeId,
}: {
  workspaces: { id: string; name: string; slug: string; isolated: boolean }[];
  activeId: string;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Workspace:</span>
      <select
        className="h-9 rounded-md border border-input bg-background px-2"
        value={activeId}
        disabled={pending}
        onChange={(e) => {
          start(async () => {
            await switchWorkspace(e.target.value);
            window.location.reload();
          });
        }}
      >
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
            {w.isolated ? " (isolato)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
