import { resolveGbpAuditSignals, textContainsGbpUrl } from "@/lib/gbp-audit-signals";

describe("gbp-audit-signals", () => {
  it("detects GBP URLs in text", () => {
    expect(textContainsGbpUrl("https://g.page/my-shop")).toBe(true);
    expect(textContainsGbpUrl("https://example.com")).toBe(false);
  });

  it("marks strong GBP when asset has profile URL", () => {
    const s = resolveGbpAuditSignals([
      {
        platform: "GBP",
        profileUrl: "https://maps.google.com/?cid=123",
        notes: null,
      },
    ]);
    expect(s.hasGbpAsset).toBe(true);
    expect(s.hasStrongGbp).toBe(true);
  });
});
