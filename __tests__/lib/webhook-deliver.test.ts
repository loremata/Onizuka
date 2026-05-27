import { buildSignedPayload, resolveWebhookBaseUrl } from "@/lib/webhook-deliver";

describe("webhook-deliver", () => {
  const prev = { nextAuth: process.env.NEXTAUTH_URL, vercel: process.env.VERCEL_URL };

  afterEach(() => {
    process.env.NEXTAUTH_URL = prev.nextAuth;
    process.env.VERCEL_URL = prev.vercel;
  });

  it("resolveWebhookBaseUrl prefers NEXTAUTH_URL", () => {
    process.env.NEXTAUTH_URL = "https://onizuka.it";
    process.env.VERCEL_URL = "xxx.vercel.app";
    expect(resolveWebhookBaseUrl()).toBe("https://onizuka.it");
  });

  it("buildSignedPayload includes signature", () => {
    const { payload, rawBody } = buildSignedPayload("secret", {
      event: "POST_APPROVED",
      clientId: "c1",
      postItemId: "p1",
      status: "APPROVED",
      platform: "FACEBOOK",
      captionText: "x",
      mediaUrls: [],
      updatedAt: new Date().toISOString(),
    });
    expect(payload.signature).toBeTruthy();
    expect(rawBody).toContain("signature");
  });
});
