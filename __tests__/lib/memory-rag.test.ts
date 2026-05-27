import { formatMemoryRagContext } from "@/lib/memory-rag";

describe("memory-rag", () => {
  it("formats context blocks", () => {
    const ctx = formatMemoryRagContext([
      {
        id: "m1",
        title: "Nota CRM",
        snippet: "Dettaglio cliente",
        scope: "CLIENT",
        score: 5,
        href: "/admin/memory/m1/edit",
        clientName: "Acme",
      },
    ]);
    expect(ctx).toContain("Nota CRM");
    expect(ctx).toContain("Acme");
  });
});
