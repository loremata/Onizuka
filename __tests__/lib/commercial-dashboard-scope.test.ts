import {
  commercialDashboardScopeNote,
  COMMERCIAL_DASHBOARD_CLIENT_COUNTS_ARE_AGENCY_WIDE,
} from "@/lib/commercial-dashboard-scope";

describe("commercialDashboardScopeNote", () => {
  it("documents agency-wide client counts", () => {
    expect(COMMERCIAL_DASHBOARD_CLIENT_COUNTS_ARE_AGENCY_WIDE).toBe(true);
    const note = commercialDashboardScopeNote();
    expect(note.clientCountsAgencyWide).toBe(true);
    expect(note.ownerScopedEntities).toContain("Lead");
    expect(note.ownerScopedEntities).toContain("Opportunity");
  });
});
