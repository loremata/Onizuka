import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { defaultSimulationVarsForTrigger } from "@/lib/automation-simulation-presets";
import { runAutomationSandbox } from "@/lib/automation-sandbox";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  let body: { ruleId?: string; payloadJson?: string };
  try {
    body = (await request.json()) as { ruleId?: string; payloadJson?: string };
  } catch {
    return NextResponse.json({ error: "Body JSON non valido." }, { status: 400 });
  }

  const ruleId = body.ruleId?.trim();
  if (!ruleId) return NextResponse.json({ error: "ruleId obbligatorio." }, { status: 400 });

  const rule = await prisma.automationRule.findFirst({
    where: { id: ruleId, ownerUserId: session.user.id },
    select: {
      trigger: true,
      conditionKey: true,
      conditionOperator: true,
      conditionValue: true,
      emailSubjectTemplate: true,
      emailBodyTemplate: true,
      webhookPayloadTemplate: true,
      flowBranchesJson: true,
    },
  });
  if (!rule) return NextResponse.json({ error: "Regola non trovata." }, { status: 404 });

  const result = runAutomationSandbox({
    trigger: rule.trigger,
    conditionKey: rule.conditionKey,
    conditionOperator: rule.conditionOperator,
    conditionValue: rule.conditionValue,
    emailSubjectTemplate: rule.emailSubjectTemplate,
    emailBodyTemplate: rule.emailBodyTemplate,
    webhookPayloadTemplate: rule.webhookPayloadTemplate,
    flowBranchesJson: rule.flowBranchesJson,
    defaultVars: defaultSimulationVarsForTrigger(rule.trigger),
    payloadJson: body.payloadJson,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
}
