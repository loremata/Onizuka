import { generatePublicReportToken, publicReportPath } from "@/lib/public-report-token";

describe("public report token", () => {
  it("generates url-safe token", () => {
    const t = generatePublicReportToken();
    expect(t.length).toBeGreaterThan(20);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("builds report path", () => {
    expect(publicReportPath("abc")).toBe("/report/abc");
  });
});
