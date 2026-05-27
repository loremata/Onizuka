import {
  formatTimeEntriesTeamSystemCsv,
  formatTimeEntriesZucchettiCsv,
} from "@/lib/time-erp-vendors";

const sample = [
  {
    id: "e1",
    ownerUserId: "u1",
    clientId: "c1",
    description: "Design",
    minutes: 120,
    workedAt: new Date("2026-05-01T10:00:00Z"),
    billable: true,
    projectCode: "WEB-01",
    hourlyRateEur: { toString: () => "80" } as never,
    approvedAt: null,
    secondApprovedAt: null,
    approvedByUserId: null,
    secondApprovedByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    owner: { email: "staff@agency.com" },
    client: { companyName: "Acme SRL" },
  },
];

describe("ERP vendor CSV", () => {
  it("zucchetti includes commessa header", () => {
    const csv = formatTimeEntriesZucchettiCsv(sample);
    expect(csv).toContain("Commessa");
    expect(csv).toContain("WEB-01");
  });

  it("teamsystem includes COD_COMMESSA", () => {
    const csv = formatTimeEntriesTeamSystemCsv(sample);
    expect(csv).toContain("COD_COMMESSA");
    expect(csv).toContain("WEB-01");
  });
});
