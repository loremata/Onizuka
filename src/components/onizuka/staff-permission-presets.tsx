"use client";

import { Button } from "@/components/ui/button";
import { STAFF_PERMISSION_PRESETS } from "@/lib/staff-permission-presets";
import type { AdminModule } from "@/lib/staff-permissions";

export function applyStaffPresetToForm(form: HTMLFormElement, modules: AdminModule[]) {
  const set = new Set(modules);
  form.querySelectorAll<HTMLInputElement>('input[name="modules"]').forEach((el) => {
    el.checked = set.has(el.value as AdminModule);
  });
}

export function StaffPermissionPresets({ formId }: { formId?: string }) {
  return (
    <div className="mb-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Preset rapidi</p>
      <div className="flex flex-wrap gap-1">
        {STAFF_PERMISSION_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            title={preset.description}
            onClick={() => {
              const form = formId
                ? document.getElementById(formId)
                : null;
              const target =
                form instanceof HTMLFormElement
                  ? form
                  : (document.activeElement?.closest("form") as HTMLFormElement | null);
              if (target) applyStaffPresetToForm(target, preset.modules);
            }}
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
