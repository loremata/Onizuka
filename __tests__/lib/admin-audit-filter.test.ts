import { AUDIT_ENTITY_TYPES } from "@/lib/admin-audit-log";

describe("admin audit filters", () => {
  it("lists entity types for UI filter", () => {
    expect(AUDIT_ENTITY_TYPES).toContain("quote");
    expect(AUDIT_ENTITY_TYPES).toContain("webhook");
  });
});
