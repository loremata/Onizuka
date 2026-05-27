import { resolveGbpLocationName } from "@/lib/gbp-location";

describe("resolveGbpLocationName", () => {
  const prev = process.env.GOOGLE_GBP_LOCATION_NAME;

  afterEach(() => {
    if (prev === undefined) delete process.env.GOOGLE_GBP_LOCATION_NAME;
    else process.env.GOOGLE_GBP_LOCATION_NAME = prev;
  });

  it("prefers asset location over env", () => {
    process.env.GOOGLE_GBP_LOCATION_NAME = "accounts/global/locations/1";
    expect(resolveGbpLocationName("accounts/client/locations/2")).toBe(
      "accounts/client/locations/2"
    );
  });

  it("falls back to env when asset empty", () => {
    process.env.GOOGLE_GBP_LOCATION_NAME = "accounts/global/locations/1";
    expect(resolveGbpLocationName(null)).toBe("accounts/global/locations/1");
  });

  it("returns null when neither set", () => {
    delete process.env.GOOGLE_GBP_LOCATION_NAME;
    expect(resolveGbpLocationName("")).toBeNull();
  });
});
