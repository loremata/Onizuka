import { auditPdfFilename } from "@/lib/audit-pdf";

describe("auditPdfFilename", () => {
  it("builds safe filenames per variant", () => {
    expect(auditPdfFilename("Rossi S.r.l.", "audit123", "internal")).toMatch(/^audit-internal-/);
    expect(auditPdfFilename("Rossi S.r.l.", "audit123", "client")).toMatch(/^audit-client-/);
  });
});
