import {
  assertNotProductionDatabase,
  assertSafeE2EBaseUrl,
  assertStagingEnvironment,
  isProductionAppHost,
  isProductionDatabaseUrl,
  isRemotePlaywrightBase,
} from "@/lib/staging-guard";

describe("staging-guard", () => {
  const prev = {
    ONIZUKA_ENV: process.env.ONIZUKA_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    ONIZUKA_STAGING_DB_MARKER: process.env.ONIZUKA_STAGING_DB_MARKER,
    PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL,
    ONIZUKA_STAGING_CONFIRM: process.env.ONIZUKA_STAGING_CONFIRM,
  };

  afterEach(() => {
    process.env.ONIZUKA_ENV = prev.ONIZUKA_ENV;
    process.env.DATABASE_URL = prev.DATABASE_URL;
    process.env.NEXTAUTH_URL = prev.NEXTAUTH_URL;
    process.env.ONIZUKA_STAGING_DB_MARKER = prev.ONIZUKA_STAGING_DB_MARKER;
    process.env.PLAYWRIGHT_BASE_URL = prev.PLAYWRIGHT_BASE_URL;
    process.env.ONIZUKA_STAGING_CONFIRM = prev.ONIZUKA_STAGING_CONFIRM;
  });

  it("detects production app host", () => {
    expect(isProductionAppHost("https://onizuka.it")).toBe(true);
    expect(isProductionAppHost("https://staging.onizuka.it")).toBe(false);
    expect(isProductionAppHost("https://onizuka-staging.vercel.app")).toBe(false);
  });

  it("blocks production database url hints", () => {
    expect(isProductionDatabaseUrl("postgresql://x@db.onizuka.it:5432/x")).toBe(true);
    expect(isProductionDatabaseUrl("postgresql://x@db.abcdef.supabase.co:5432/x")).toBe(false);
  });

  it("assertStagingEnvironment requires marker on staging", () => {
    process.env.ONIZUKA_ENV = "staging";
    process.env.DATABASE_URL = "postgresql://x@db.stagingref.supabase.co:5432/x";
    process.env.ONIZUKA_STAGING_DB_MARKER = "stagingref";
    process.env.NEXTAUTH_URL = "https://onizuka-staging.vercel.app";
    expect(() => assertStagingEnvironment({ requireConfirm: false })).not.toThrow();
  });

  it("assertSafeE2EBaseUrl rejects production", () => {
    expect(() => assertSafeE2EBaseUrl("https://onizuka.it")).toThrow(/produzione/i);
    expect(() => assertSafeE2EBaseUrl("http://localhost:3000")).not.toThrow();
    expect(() => assertSafeE2EBaseUrl("https://onizuka-staging.vercel.app")).not.toThrow();
  });

  it("isRemotePlaywrightBase detects remote", () => {
    process.env.PLAYWRIGHT_BASE_URL = "https://staging.example.vercel.app";
    expect(isRemotePlaywrightBase()).toBe(true);
    process.env.PLAYWRIGHT_BASE_URL = "http://localhost:3000";
    expect(isRemotePlaywrightBase()).toBe(false);
  });

  it("assertNotProductionDatabase rejects prod nextauth", () => {
    process.env.DATABASE_URL = "postgresql://localhost/test";
    process.env.NEXTAUTH_URL = "https://onizuka.it";
    expect(() => assertNotProductionDatabase()).toThrow(/NEXTAUTH_URL/i);
  });
});
