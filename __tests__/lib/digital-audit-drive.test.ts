import { AUDIT_DRIVE_SUBFOLDER, CLIENT_DRIVE_FOLDERS } from "@/lib/client-drive-structure";

describe("digital audit drive", () => {
  it("uses audit subfolder from standard structure", () => {
    expect(AUDIT_DRIVE_SUBFOLDER).toBe("04_Audit");
    expect(CLIENT_DRIVE_FOLDERS).toContain(AUDIT_DRIVE_SUBFOLDER);
  });
});
