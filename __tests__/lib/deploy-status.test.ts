import { buildDeployStatusReport } from "@/lib/deploy-status";

// NODE_ENV è tipizzato read-only da @types/node: cast mirato del solo process.env per i test.
const env = process.env as Record<string, string | undefined>;

describe("deploy-status", () => {
  const prev = {
    nodeEnv: process.env.NODE_ENV,
    secret: process.env.NEXTAUTH_SECRET,
    url: process.env.NEXTAUTH_URL,
    s3: process.env.S3_BUCKET,
  };

  afterEach(() => {
    env.NODE_ENV = prev.nodeEnv;
    process.env.NEXTAUTH_SECRET = prev.secret;
    process.env.NEXTAUTH_URL = prev.url;
    process.env.S3_BUCKET = prev.s3;
    delete process.env.S3_ACCESS_KEY;
    delete process.env.S3_SECRET_KEY;
  });

  it("warns on Vercel preview", () => {
    process.env.VERCEL_ENV = "preview";
    const report = buildDeployStatusReport();
    expect(report.vercelEnv).toBe("preview");
    expect(report.warnings.some((w) => w.includes("Preview"))).toBe(true);
    delete process.env.VERCEL_ENV;
  });

  it("flags missing storage in production", () => {
    env.NODE_ENV = "production";
    process.env.NEXTAUTH_SECRET = "x".repeat(32);
    process.env.NEXTAUTH_URL = "https://onizuka.it";
    delete process.env.S3_BUCKET;
    delete process.env.S3_ACCESS_KEY;
    delete process.env.S3_SECRET_KEY;
    delete process.env.ALLOW_LOCAL_UPLOAD_SERVE;
    const report = buildDeployStatusReport();
    expect(report.productionReady).toBe(false);
    expect(report.issues.some((i) => i.includes("Storage"))).toBe(true);
  });
});
