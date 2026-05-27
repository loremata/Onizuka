import { formatTimeEntriesCsv } from "@/lib/time-entry-export";

describe("formatTimeEntriesCsv", () => {
  it("include BOM e header esteso", () => {
    const rows = [
      {
        id: "t1",
        ownerUserId: "u1",
        clientId: "c1",
        description: "Test, con \"virgolette\"",
        minutes: 30,
        workedAt: new Date("2026-01-15T10:00:00.000Z"),
        createdAt: new Date("2026-01-15T12:00:00.000Z"),
        updatedAt: new Date("2026-01-15T12:00:00.000Z"),
        billable: true,
        hourlyRateEur: null,
        projectCode: null,
        approvedAt: null,
        approvedByUserId: null,
        client: { companyName: "Acme Srl" },
      },
    ];
    const csv = formatTimeEntriesCsv(rows as never);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain(
      "workedAt,minutes,billable,hourlyRateEur,lineEurEst,projectCode,approvedAt,secondApprovedAt,description,client,createdAt,id"
    );
    expect(csv).toContain("Acme Srl");
    expect(csv).toContain('"Test, con ""virgolette"""');
  });
});
