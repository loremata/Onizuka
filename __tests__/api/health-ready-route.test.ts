/**
 * @jest-environment node
 */

import { GET } from "@/app/api/health/ready/route";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

describe("GET /api/health/ready", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("risponde 200 quando il database risponde", async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ "?column?": 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      status: "ready",
      database: "ok",
    });
  });

  it("risponde 503 con codice stabile quando la query fallisce", async () => {
    (prisma.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error("connection refused"));
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: false,
      status: "not_ready",
      database: "error",
      code: "DATABASE_NOT_READY",
      error: "Database non disponibile",
    });
    expect(body.detail).toContain("connection refused");
  });
});
