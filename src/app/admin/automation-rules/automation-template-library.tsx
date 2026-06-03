import { dateTimeFormatIt } from "@/lib/datetime-it";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AutomationTemplateUseButton } from "./automation-template-use-button";

export async function AutomationTemplateLibrary() {
  const session = await requireAdminArea();
  const templates = await prisma.automationRuleTemplate.findMany({
    where: { OR: [{ ownerUserId: session.user.id }, { shared: true }] },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  if (templates.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Marketplace template (team)</CardTitle>
        <CardDescription>Template salvati da regole esistenti. Import crea una copia disattivata.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y text-sm">
          {templates.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.shared ? "Condiviso team" : "Solo tu"} ·{" "}
                  {dateTimeFormatIt({ dateStyle: "short" }).format(t.createdAt)}
                </p>
              </div>
              <AutomationTemplateUseButton templateId={t.id} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
