import { formatAuditLogCsv } from "@/lib/audit-export";
import type { AdminAuditLogEntry } from "@/lib/admin-audit-log";

describe("audit-export", () => {
  it("formats CSV with header and escaped fields", () => {
    const entries: AdminAuditLogEntry[] = [
      {
        id: "1",
        at: new Date("2026-05-23T10:00:00Z"),
        action: "login.failed",
        summary: 'Tentativo con virgola, e "quote"',
        entityType: null,
        entityId: null,
        actorEmail: "sistema",
        actorName: null,
      },
    ];
    const csv = formatAuditLogCsv(entries);
    expect(csv.split("\n")[0]).toContain("data");
    expect(csv).toContain("login.failed");
    expect(csv).toContain('"Tentativo con virgola, e ""quote"""');
  });
});
