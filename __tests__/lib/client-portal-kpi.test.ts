import { countUnreadTickets } from "@/lib/ticket-unread";

describe("client-portal-kpi helpers", () => {
  it("counts tickets with unread admin replies for KPI", () => {
    const n = countUnreadTickets([
      { updates: [] },
      {
        updates: [{ createdByUserId: "admin", clientReadAt: null }],
      },
    ]);
    expect(n).toBe(1);
  });
});
