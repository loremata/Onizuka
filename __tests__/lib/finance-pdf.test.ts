import { financeSummaryPdfFilename } from "@/lib/finance-pdf";

describe("financeSummaryPdfFilename", () => {
  it("slugifies month label", () => {
    expect(financeSummaryPdfFilename("maggio 2026")).toContain("onizuka-finance");
    expect(financeSummaryPdfFilename("maggio 2026")).toMatch(/\.pdf$/);
  });
});
