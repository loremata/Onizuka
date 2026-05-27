/** @jest-environment node */

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({ authOptions: {} }));

jest.mock("@/lib/deploy-status", () => ({
  buildDeployStatusReport: jest.fn(() => ({
    productionReady: true,
    issues: [],
    warnings: [],
    environment: "test",
    onizukaEnv: "production",
    vercelEnv: null,
    appUrl: "https://onizuka.it",
    vercel: false,
    capabilities: {},
  })),
}));

jest.mock("@/lib/production-readiness", () => ({
  buildProductionReadinessChecklist: jest.fn(() => [{ id: "auth", label: "Auth", status: "done" }]),
}));

jest.mock("@/lib/seed-password-check", () => ({
  findAccountsWithDefaultSeedPasswords: jest.fn(async () => []),
}));

jest.mock("@/lib/telegram-bot", () => ({
  isTelegramConfigured: jest.fn(() => true),
}));

jest.mock("@/lib/finance-reconciliation", () => ({
  loadFinanceReconciliation: jest.fn(async () => ({ ok: false })),
}));

jest.mock("@/lib/db-migration-status", () => ({
  probeBatchFMigration: jest.fn(async () => ({ batchF: true })),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: jest.fn(async () => 1),
    user: { count: jest.fn(async () => 0) },
  },
}));

import { getServerSession } from "next-auth";
import { GET } from "@/app/api/admin/go-live/diagnostics/route";

describe("GET /api/admin/go-live/diagnostics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("401 senza sessione admin", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("200 con diagnostica aggregata", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { role: "ADMIN" } });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.productionReady).toBe(true);
    expect(json.database).toBe("ok");
    expect(json.missingSteps).toBeDefined();
    expect(json.batchFMigration?.batchF).toBe(true);
  });
});
