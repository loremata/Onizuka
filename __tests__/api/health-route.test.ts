/** @jest-environment node */

jest.mock("@/lib/onizuka-env", () => ({
  getOnizukaEnv: () => "production",
}));

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("restituisce ok e metadati", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.service).toBe("onizuka");
    expect(json.env).toBe("production");
  });
});
