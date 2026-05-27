import { getOnizukaEnv, stagingDatabaseMismatchWarning } from "@/lib/onizuka-env";

describe("onizuka-env", () => {
  const prev = {
    onizuka: process.env.ONIZUKA_ENV,
    vercel: process.env.VERCEL_ENV,
    node: process.env.NODE_ENV,
    db: process.env.DATABASE_URL,
    marker: process.env.ONIZUKA_STAGING_DB_MARKER,
  };

  afterEach(() => {
    process.env.ONIZUKA_ENV = prev.onizuka;
    process.env.VERCEL_ENV = prev.vercel;
    process.env.NODE_ENV = prev.node;
    process.env.DATABASE_URL = prev.db;
    process.env.ONIZUKA_STAGING_DB_MARKER = prev.marker;
  });

  it("reads explicit staging", () => {
    process.env.ONIZUKA_ENV = "staging";
    expect(getOnizukaEnv()).toBe("staging");
  });

  it("warns when staging db marker missing", () => {
    process.env.ONIZUKA_ENV = "staging";
    process.env.ONIZUKA_STAGING_DB_MARKER = "stagingref";
    process.env.DATABASE_URL = "postgresql://user:pass@db.prodref.supabase.co:5432/postgres";
    expect(stagingDatabaseMismatchWarning()).toContain("stagingref");
  });
});
