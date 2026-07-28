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

describe("segnaposto @onizuka.local", () => {
  const c = (vatNumber: string | null, contactEmail: string) =>
    ({ vatNumber, contactEmail }) as never;

  it("due segnaposto diversi NON sono un conflitto: sono due sconosciuti", () => {
    const res = assertMergeClientsAllowed(
      c(null, "lead+aaa@onizuka.local"),
      c(null, "lead+bbb@onizuka.local")
    );
    expect(res.ok).toBe(true);
  });

  it("segnaposto contro email reale: si può unire", () => {
    expect(assertMergeClientsAllowed(c(null, "info@officina.it"), c(null, "prospect+123@onizuka.local")).ok).toBe(true);
  });

  it("due email REALI diverse restano un conflitto", () => {
    const res = assertMergeClientsAllowed(c(null, "info@officina.it"), c(null, "info@altro.it"));
    expect(res.ok).toBe(false);
  });
});
