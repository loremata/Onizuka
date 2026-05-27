import { test, expect } from "@playwright/test";
import {
  runE2eAuditByVat,
  runE2eAuditDomainOnly,
  cleanupE2eAuditRecords,
  type E2eAuditContext,
} from "./fixtures/commercial-audit-e2e";

/**
 * E2E audit → CRM.
 * - Server: `runDigitalAuditByVat` / `runDigitalAuditUnified` (identico a `startDigitalAuditByVat`).
 * - UI: dettaglio, pipeline, lead/client, assenza duplicati anomali.
 * - Shell form: `admin-audit-commercial-crm-shell.spec.ts`.
 * - Probe esterno: mock con `PLAYWRIGHT_E2E=1` in `website-probe.ts`.
 * - Dominio-only: client pre-seeded con stesso dominio (match CM-01, come in produzione).
 */
test.describe("Admin · audit commerciale → CRM", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });

  const stamp = Date.now();
  const businessName = `E2E Audit CRM ${stamp}`;
  const vatNew = `IT6${String(stamp).slice(-10).padStart(10, "0")}`.slice(0, 13);
  const website = `https://e2e-${stamp}.example.test`;

  let ctxA: E2eAuditContext;
  let ctxB: E2eAuditContext | undefined;
  let ctxDomain: E2eAuditContext | undefined;
  const auditIds: string[] = [];
  const clientIds: string[] = [];
  const leadIds: string[] = [];

  test.afterAll(async () => {
    await cleanupE2eAuditRecords({
      businessNamePrefix: "E2E Audit CRM",
      auditIds,
      clientIds,
      leadIds,
    });
  });

  test("Scenario A — audit P.IVA nuova (server) + dettaglio UI", async ({ page }) => {
    ctxA = await runE2eAuditByVat({
      vatNumber: vatNew,
      website,
      businessName,
    });
    auditIds.push(ctxA.auditId);
    clientIds.push(ctxA.clientId);
    if (ctxA.leadId) leadIds.push(ctxA.leadId);

    await page.goto(`/admin/audit/digital/${ctxA.auditId}`);
    await expect(page).toHaveURL(new RegExp(`/admin/audit/digital/${ctxA.auditId}$`));
    await expect(page.getByRole("heading", { name: /Punteggi per sezione/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(businessName).first()).toBeVisible({ timeout: 15_000 });
  });

  test("Scenario A — lead e client in CRM", async ({ page }) => {
    const clientName = ctxA.clientCompanyName ?? businessName;
    const leadName = ctxA.leadBusinessName ?? businessName;
    await page.goto("/admin/crm/leads");
    await expect(page.getByText(leadName).first()).toBeVisible({ timeout: 30_000 });

    await page.goto(`/admin/clients/${ctxA.clientId}`);
    await expect(page.locator("h1").first()).toHaveText(clientName, { timeout: 30_000 });
  });

  test("Scenario A — pipeline opportunità e task", async ({ page }) => {
    await page.goto("/admin/crm/pipeline");
    await expect(page.getByRole("heading", { name: /pipeline/i })).toBeVisible();

    if (ctxA.opportunityId) {
      await expect(page.locator(`[data-opp-id="${ctxA.opportunityId}"]`)).toBeVisible({
        timeout: 30_000,
      });
    } else if (ctxA.opportunityTitle) {
      await expect(page.getByRole("link", { name: ctxA.opportunityTitle })).toBeVisible({
        timeout: 30_000,
      });
    } else {
      await expect(page.getByRole("link", { name: /^Audit ·/ }).first()).toBeVisible({
        timeout: 30_000,
      });
    }

    await page.goto("/admin/flow");
    await expect(page.getByRole("heading", { name: /flow|task/i }).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("Scenario B — secondo audit stessa P.IVA (server, nessun errore)", async ({ page }) => {
    ctxB = await runE2eAuditByVat({
      vatNumber: vatNew,
      businessName: `${businessName} — rerun`,
    });
    auditIds.push(ctxB.auditId);
    expect(ctxB.clientId).toBe(ctxA.clientId);

    await page.goto(`/admin/audit/digital/${ctxB.auditId}`);
    await expect(page).toHaveURL(new RegExp(`/admin/audit/digital/${ctxB.auditId}$`));
    await expect(page.getByRole("heading", { name: /Punteggi per sezione/i })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("Scenario B — nessun client duplicato per stessa P.IVA", async () => {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    try {
      const clients = await prisma.client.findMany({
        where: { vatNumber: vatNew },
        select: { id: true },
      });
      expect(clients.length).toBeLessThanOrEqual(1);
    } finally {
      await prisma.$disconnect();
    }
  });

  test("Scenario C — dominio-only (server + UI dettaglio)", async ({ page }) => {
    const domainName = `E2E Audit CRM domain ${stamp}`;
    ctxDomain = await runE2eAuditDomainOnly({
      website: `https://solo-dominio-${stamp}.example.test`,
      businessName: domainName,
    });
    auditIds.push(ctxDomain.auditId);
    clientIds.push(ctxDomain.clientId);
    if (ctxDomain.leadId) leadIds.push(ctxDomain.leadId);

    await page.goto(`/admin/audit/digital/${ctxDomain.auditId}`);
    await expect(page).toHaveURL(new RegExp(`/admin/audit/digital/${ctxDomain.auditId}$`));
    await expect(page.getByText(domainName).first()).toBeVisible({ timeout: 30_000 });
  });
});
