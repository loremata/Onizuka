"use client";

import { ALL_ADMIN_MODULES, STAFF_MODULE_LABELS, type AdminModule } from "@/lib/staff-permissions";

export function StaffModuleChecklist({
  name = "modules",
  selected,
  disabled,
  compact,
}: {
  name?: string;
  selected: Set<string>;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <ul className={compact ? "flex flex-wrap gap-2" : "grid gap-2 sm:grid-cols-2"}>
      {ALL_ADMIN_MODULES.map((mod) => (
        <li
          key={mod}
          className={
            compact
              ? "flex items-center gap-1 rounded border border-border px-2 py-1 text-xs"
              : "flex items-start gap-2 text-sm"
          }
        >
          <input
            type="checkbox"
            name={name}
            value={mod}
            defaultChecked={selected.has(mod)}
            disabled={disabled}
            className={compact ? "" : "mt-1"}
          />
          <label className={compact ? "whitespace-nowrap" : ""}>
            <span className="font-medium">{STAFF_MODULE_LABELS[mod as AdminModule]}</span>
            {!compact ? (
              <span className="block text-xs text-muted-foreground">{mod}</span>
            ) : null}
          </label>
        </li>
      ))}
    </ul>
  );
}
