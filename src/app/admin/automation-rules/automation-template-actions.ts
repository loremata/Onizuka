"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea } from "@/lib/admin-session";
import { automationRuleToSnapshot } from "@/lib/automation-rule-snapshot";
import { prisma } from "@/lib/prisma";
import { importAutomationRuleFromJson } from "./actions";

export async function saveAutomationRuleAsTemplate(
  ruleId: string,
  name: string,
  shared: boolean,
  marketplace = false
) {
  const session = await requireAdminArea();
  const rule = await prisma.automationRule.findFirst({
    where: { id: ruleId, ownerUserId: session.user.id },
  });
  if (!rule) return { error: "Regola non trovata." };

  const label = name.trim().slice(0, 120) || `${rule.name} (template)`;
  await prisma.automationRuleTemplate.create({
    data: {
      ownerUserId: session.user.id,
      name: label,
      snapshotJson: JSON.stringify(automationRuleToSnapshot(rule)),
      shared: shared || marketplace,
      marketplace,
    },
  });

  revalidatePath("/admin/automation-rules");
  return { ok: true as const };
}

export async function createRuleFromTemplate(templateId: string) {
  const session = await requireAdminArea();
  const tpl = await prisma.automationRuleTemplate.findFirst({
    where: {
      id: templateId,
      OR: [{ ownerUserId: session.user.id }, { shared: true }, { marketplace: true }],
    },
  });
  if (!tpl) return { error: "Template non trovato." };

  return importAutomationRuleFromJson(JSON.stringify({ rule: JSON.parse(tpl.snapshotJson) }));
}
