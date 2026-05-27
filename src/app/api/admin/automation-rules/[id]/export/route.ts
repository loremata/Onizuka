import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { jsonApiError } from "@/lib/api-json-errors";
import { automationRuleToSnapshot } from "@/lib/automation-rule-snapshot";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return jsonApiError(401, "UNAUTHORIZED", "Non autorizzato.");

  const { id } = await params;
  const rule = await prisma.automationRule.findFirst({
    where: { id, ownerUserId: session.user.id },
  });
  if (!rule) return jsonApiError(404, "NOT_FOUND", "Regola non trovata.");

  const snapshot = automationRuleToSnapshot(rule);
  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    ruleVersion: rule.ruleVersion,
    rule: snapshot,
  });
}
