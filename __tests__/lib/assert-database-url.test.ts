import { assertProductionDatabaseUrl } from "@/lib/assert-database-url";

describe("assertProductionDatabaseUrl", () => {
  const prev = { nodeEnv: process.env.NODE_ENV, db: process.env.DATABASE_URL, direct: process.env.DIRECT_URL };

  afterEach(() => {
    process.env.NODE_ENV = prev.nodeEnv;
    process.env.DATABASE_URL = prev.db;
    process.env.DIRECT_URL = prev.direct;
  });

  it("warns when Supabase URL is direct-only in production", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://u:p@db.abc.supabase.co:5432/postgres";
    process.env.DIRECT_URL = "";
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
    assertProductionDatabaseUrl();
    expect(spy.mock.calls.some((c) => String(c[0]).includes("pooler"))).toBe(true);
    spy.mockRestore();
  });
});
