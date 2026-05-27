import {
  filterAdminNav,
  staffCanAccessPath,
  pathnameAdminModule,
} from "@/lib/staff-permissions";

describe("staff-permissions", () => {
  it("denies STAFF finance and users", () => {
    expect(staffCanAccessPath("STAFF", "/admin/finance")).toBe(false);
    expect(staffCanAccessPath("STAFF", "/admin/users")).toBe(false);
    expect(staffCanAccessPath("STAFF", "/admin/go-live")).toBe(false);
  });

  it("allows STAFF crm and flow", () => {
    expect(staffCanAccessPath("STAFF", "/admin/crm/leads")).toBe(true);
    expect(staffCanAccessPath("STAFF", "/admin/flow")).toBe(true);
    expect(staffCanAccessPath("STAFF", "/admin/voice")).toBe(true);
  });

  it("allows ADMIN everything", () => {
    expect(staffCanAccessPath("ADMIN", "/admin/finance")).toBe(true);
  });

  it("filters nav for staff", () => {
    const items = [
      { href: "/admin/flow", label: "Flow" },
      { href: "/admin/finance", label: "Finanza" },
    ];
    const filtered = filterAdminNav("STAFF", items);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].href).toBe("/admin/flow");
  });

  it("allows finance when whitelisted", () => {
    expect(staffCanAccessPath("STAFF", "/admin/finance", ["finance", "crm"])).toBe(true);
  });

  it("maps pathname to module", () => {
    expect(pathnameAdminModule("/admin/finance")).toBe("finance");
    expect(pathnameAdminModule("/admin/reach/sequences")).toBe("reach");
  });
});
