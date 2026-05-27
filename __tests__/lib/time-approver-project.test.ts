import { canApproveTimeEntryProject } from "@/lib/time-approver";

describe("canApproveTimeEntryProject", () => {
  it("allows any project when whitelist empty", () => {
    expect(canApproveTimeEntryProject("PROJ-A", [])).toBe(true);
    expect(canApproveTimeEntryProject(null, [])).toBe(true);
  });

  it("requires matching project code when whitelist set", () => {
    expect(canApproveTimeEntryProject("proj-a", ["PROJ-A"])).toBe(true);
    expect(canApproveTimeEntryProject("PROJ-B", ["PROJ-A"])).toBe(false);
    expect(canApproveTimeEntryProject(null, ["PROJ-A"])).toBe(false);
  });
});
