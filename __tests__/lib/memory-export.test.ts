import { formatMemoryCsv, maskMemoryContent } from "@/lib/memory-export";

describe("memory-export", () => {
  it("formats csv with header", () => {
    const csv = formatMemoryCsv([
      {
        id: "m1",
        scope: "CLIENT",
        title: "Nota",
        content: "Test, con virgola",
        tags: ["crm"],
        sensitivity: "LOW",
        source: "MANUAL",
        clientName: "Acme",
        updatedAt: new Date("2026-05-15T10:00:00.000Z"),
      },
    ]);
    expect(csv.split("\n")[0]).toContain("title");
    expect(csv).toContain("Acme");
    expect(csv).toContain('"Test, con virgola"');
  });

  it("redacts HIGH sensitivity or SENSITIVE scope when masked", () => {
    expect(maskMemoryContent("segreto", "HIGH", "CLIENT", true)).toContain("SENSIBILE");
    expect(maskMemoryContent("segreto", "LOW", "SENSITIVE", true)).toContain("SENSIBILE");
    expect(maskMemoryContent("segreto", "HIGH", "CLIENT", false)).toBe("segreto");
  });
});
