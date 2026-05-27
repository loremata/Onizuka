import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { enqueueAutomationFlowRun } from "@/lib/automation-flow-queue";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  let body: { ruleId?: string; branchId?: string; payload?: Record<string, unknown>; delayMs?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON non valido." }, { status: 400 });
  }

  const ruleId = body.ruleId?.trim();
  if (!ruleId) return NextResponse.json({ error: "ruleId obbligatorio." }, { status: 400 });

  const rule = await prisma.automationRule.findFirst({
    where: { id: ruleId, ownerUserId: session.user.id },
    select: { id: true },
  });
  if (!rule) return NextResponse.json({ error: "Regola non trovata." }, { status: 404 });

  const runId = await enqueueAutomationFlowRun({
    ruleId,
    ownerUserId: session.user.id,
    branchId: body.branchId,
    payloadJson: body.payload,
    delayMs: body.delayMs,
  });

  return NextResponse.json({ runId });
}
