import { assertMergeClientsAllowed } from "@/lib/client-merge-guard";

describe("assertMergeClientsAllowed", () => {
  it("consente merge se una P.IVA manca", () => {
    expect(
      assertMergeClientsAllowed(
        { vatNumber: "IT12345678901", contactEmail: "x@y.com" },
        { vatNumber: null, contactEmail: "x@y.com" }
      ).ok
    ).toBe(true);
  });

  it("blocca merge se P.IVA normalizzate diverse", () => {
    const r = assertMergeClientsAllowed(
      { vatNumber: "IT 12345678901", contactEmail: "a@b.it" },
      { vatNumber: "IT98765432109", contactEmail: "a@b.it" }
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Partita IVA/i);
  });

  it("blocca merge se email contatto normalizzate diverse", () => {
    const r = assertMergeClientsAllowed(
      { vatNumber: null, contactEmail: "a@x.com" },
      { vatNumber: null, contactEmail: "b@y.com" }
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/email/i);
  });
});
