import { signOAuthState, verifyOAuthState } from "@/lib/oauth-state";

describe("oauth-state", () => {
  const prev = process.env.NEXTAUTH_SECRET;

  beforeAll(() => {
    process.env.NEXTAUTH_SECRET = "x".repeat(32);
  });

  afterAll(() => {
    process.env.NEXTAUTH_SECRET = prev;
  });

  it("round-trips valid state", () => {
    const state = signOAuthState("user-1", "GOOGLE_CALENDAR");
    const parsed = verifyOAuthState(state);
    expect(parsed?.userId).toBe("user-1");
    expect(parsed?.provider).toBe("GOOGLE_CALENDAR");
  });
});
