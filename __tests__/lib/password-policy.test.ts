import { isWeakPassword } from "@/lib/password-policy";

describe("isWeakPassword", () => {
  it("rileva password seed", () => {
    expect(isWeakPassword("admin123")).toBe(true);
    expect(isWeakPassword("client123")).toBe(true);
  });

  it("accetta password forte", () => {
    expect(isWeakPassword("K9#mara-2026-Onizuka!")).toBe(false);
  });
});
