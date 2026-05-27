import {
  STAFF_PERMISSION_PRESETS,
  getStaffPermissionPreset,
} from "@/lib/staff-permission-presets";

describe("staff-permission-presets", () => {
  it("includes operativo preset without finance", () => {
    const operativo = getStaffPermissionPreset("operativo");
    expect(operativo?.modules).toContain("crm");
    expect(operativo?.modules).not.toContain("finance");
    expect(operativo?.modules).not.toContain("users");
  });

  it("default-policy has empty modules", () => {
    const def = getStaffPermissionPreset("default-policy");
    expect(def?.modules).toEqual([]);
  });

  it("has unique preset ids", () => {
    const ids = STAFF_PERMISSION_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
