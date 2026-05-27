import { CLIENT_DRIVE_FOLDERS } from "@/lib/client-drive-structure";
import { addBusinessDays } from "@/lib/audit-follow-up";

describe("client drive structure", () => {
  it("defines 9 standard subfolders from spec", () => {
    expect(CLIENT_DRIVE_FOLDERS).toHaveLength(9);
    expect(CLIENT_DRIVE_FOLDERS).toContain("04_Audit");
    expect(CLIENT_DRIVE_FOLDERS[0]).toBe("01_Anagrafica");
  });
});

describe("addBusinessDays", () => {
  it("skips weekends", () => {
    const friday = new Date("2026-05-15T12:00:00");
    const result = addBusinessDays(friday, 1);
    expect(result.getDay()).toBe(1);
  });
});
