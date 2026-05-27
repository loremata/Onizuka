import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminAreaRole } from "@/lib/auth-roles";
import { formatAutomationExecutionsCsv } from "@/lib/automation-execution-export";
import { resolveAutomationKpiRange } from "@/lib/automation-kpi-date-range";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MAX_ROWS = 10000;

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isAdminAreaRole(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const { from, to, fromDay, toDay } = resolveAutomationKpiRange({
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });

  const rows = await prisma.automationRuleExecution.findMany({
    where: {
      rule: { ownerUserId: session.user.id },
      createdAt: { gte: from, lte: to },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    select: {
      id: true,
      createdAt: true,
      channel: true,
      success: true,
      attemptCount: true,
      errorDetail: true,
      rule: { select: { name: true } },
    },
  });

  const csv = formatAutomationExecutionsCsv(rows);
  const filename = `onizuka-automation-executions-${fromDay}_${toDay}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
