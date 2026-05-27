/**
 * Bridge Playwright → scripts/e2e-audit-fixture.ts (tsx, stesso stack server actions).
 */
import { spawnSync } from "node:child_process";

export type E2eAuditContext = {
  auditId: string;
  clientId: string;
  clientCompanyName?: string;
  leadId?: string;
  leadBusinessName?: string;
  opportunityId?: string;
  opportunityTitle?: string;
  vat: string;
  businessName: string;
  ownerUserId: string;
};

function runFixture(cmd: string, payload: Record<string, unknown>): E2eAuditContext {
  const proc = spawnSync("npx", ["tsx", "scripts/e2e-audit-fixture.ts", cmd], {
    cwd: process.cwd(),
    encoding: "utf8",
    input: JSON.stringify(payload),
    shell: process.platform === "win32",
    env: { ...process.env, PLAYWRIGHT_E2E: "1", ONIZUKA_E2E: "1" },
  });
  if (proc.status !== 0) {
    throw new Error(
      `Fixture E2E audit (${cmd}) fallita: ${proc.stderr || proc.stdout || proc.status}`
    );
  }
  const line = proc.stdout.trim().split("\n").pop() ?? "";
  return JSON.parse(line) as E2eAuditContext;
}

export async function runE2eAuditByVat(params: {
  vatNumber: string;
  website?: string;
  businessName: string;
  createOutreachDraft?: boolean;
}): Promise<E2eAuditContext> {
  return runFixture("run-vat", params);
}

export async function runE2eAuditDomainOnly(params: {
  website: string;
  businessName: string;
}): Promise<E2eAuditContext> {
  return runFixture("run-domain", params);
}

export async function cleanupE2eAuditRecords(opts: {
  businessNamePrefix?: string;
  clientIds?: string[];
  leadIds?: string[];
  auditIds?: string[];
}) {
  spawnSync("npx", ["tsx", "scripts/e2e-audit-fixture.ts", "cleanup"], {
    cwd: process.cwd(),
    encoding: "utf8",
    input: JSON.stringify(opts),
    shell: process.platform === "win32",
    env: process.env,
  });
}

export async function disconnectE2ePrisma() {
  // no-op: Prisma vive nel processo tsx dello script
}
