import { askIntentHref, resolveAskIntent } from "@/lib/ask-onizuka";

describe("resolveAskIntent", () => {
  it("routes pipeline keyword to pipeline board", () => {
    const intent = resolveAskIntent("apri pipeline");
    expect(intent).toEqual({
      kind: "navigate",
      href: "/admin/crm/pipeline",
      label: "Pipeline opportunità",
    });
  });

  it("extracts search query after cerca", () => {
    const intent = resolveAskIntent("cerca Demo Client");
    expect(intent).toEqual({ kind: "search", q: "Demo Client" });
    expect(askIntentHref(intent)).toBe("/admin/search?q=Demo%20Client");
  });

  it("defaults unknown text to global search", () => {
    const intent = resolveAskIntent("restyling sito");
    expect(intent).toEqual({ kind: "search", q: "restyling sito" });
  });

  it("routes asset keyword to clients module", () => {
    expect(resolveAskIntent("asset social")).toMatchObject({
      kind: "navigate",
      href: "/admin/clients",
      label: "Asset clienti",
    });
  });

  it("routes flow / scadenze to flow module", () => {
    expect(resolveAskIntent("task urgenti")).toMatchObject({ kind: "navigate", href: "/admin/flow" });
    expect(resolveAskIntent("scadenze oggi")).toMatchObject({
      kind: "navigate",
      href: "/admin/flow?due=today",
    });
    expect(resolveAskIntent("task in ritardo")).toMatchObject({
      href: "/admin/flow?due=overdue",
    });
  });
});
