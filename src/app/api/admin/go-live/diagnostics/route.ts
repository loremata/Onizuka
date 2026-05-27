import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildDeployStatusReport } from "@/lib/deploy-status";
import { buildProductionReadinessChecklist } from "@/lib/production-readiness";
import { prisma } from "@/lib/prisma";
import { findAccountsWithDefaultSeedPasswords } from "@/lib/seed-password-check";
import { isTelegramConfigured } from "@/lib/telegram-bot";
import { loadFinanceReconciliation } from "@/lib/finance-reconciliation";
import { buildOpsClosureChecklist } from "@/lib/ops-readiness";
import { probeBatchFMigration } from "@/lib/db-migration-status";
import { buildGoLiveMissingSteps } from "@/lib/go-live-missing-steps";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const opsClosure = buildOpsClosureChecklist();
  const [report, weakEmails, readiness, financeReconciliation, batchF] = await Promise.all([
    Promise.resolve(buildDeployStatusReport()),
    findAccountsWithDefaultSeedPasswords(),
    Promise.resolve(buildProductionReadinessChecklist()),
    loadFinanceReconciliation(session.user.id),
    probeBatchFMigration(),
  ]);

  let database: "ok" | "error" = "error";
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "ok";
  } catch {
    database = "error";
  }

  const readinessTodo = readiness.filter((r) => r.status === "todo").length;

  const mustChangePasswordCount = await prisma.user.count({
    where: { mustChangePassword: true },
  });

  const missingSteps = buildGoLiveMissingSteps({
    readiness,
    opsClosure,
    databaseOk: database === "ok",
    batchFMigrated: batchF.batchF,
    weakSeedEmails: weakEmails,
    mustChangePasswordCount,
  });

  return NextResponse.json({
    productionReady:
      report.productionReady &&
      weakEmails.length === 0 &&
      database === "ok" &&
      mustChangePasswordCount === 0 &&
      batchF.batchF &&
      missingSteps.requiredOpen === 0,
    deploy: report,
    database,
    weakSeedEmails: weakEmails,
    mustChangePasswordCount,
    readiness,
    readinessTodo,
    opsClosure,
    batchFMigration: batchF,
    missingSteps,
    telegram: isTelegramConfigured(),
    appUrl: process.env.NEXTAUTH_URL?.trim() ?? null,
    financeReconciliation: financeReconciliation.ok
      ? {
          healthy: financeReconciliation.report.healthy,
          stripeEnabled: financeReconciliation.report.stripeEnabled,
          issues: financeReconciliation.report.rows.filter((r) => r.severity !== "ok"),
        }
      : null,
  });
}
