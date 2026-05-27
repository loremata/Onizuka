import {
  signOutreachDraftId,
  verifyOutreachDraftToken,
  buildOutreachOpenPixelUrl,
} from "@/lib/outreach-tracking";

describe("outreach-tracking", () => {
  it("signs and verifies draft token", () => {
    const id = "draft_test_123";
    const token = signOutreachDraftId(id);
    expect(verifyOutreachDraftToken(id, token)).toBe(true);
    expect(verifyOutreachDraftToken(id, "bad")).toBe(false);
  });

  it("builds pixel url", () => {
    process.env.NEXTAUTH_URL = "https://onizuka.it";
    const url = buildOutreachOpenPixelUrl("abc");
    expect(url).toContain("/api/reach/track/open/abc/");
  });
});
