import { assertOpportunityParty } from "@/lib/opportunity-party";

describe("assertOpportunityParty", () => {
  it("requires at least client or lead", () => {
    expect(assertOpportunityParty({})).toMatch(/almeno/i);
    expect(assertOpportunityParty({ clientId: "c1" })).toBeNull();
    expect(assertOpportunityParty({ leadId: "l1" })).toBeNull();
    expect(assertOpportunityParty({ clientId: "c1", leadId: "l1" })).toBeNull();
  });
});
