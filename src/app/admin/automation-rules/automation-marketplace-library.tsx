import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AutomationTemplateUseButton } from "./automation-template-use-button";

/** Template pubblicati in marketplace da altri admin. */
export async function AutomationMarketplaceLibrary() {
  const session = await requireAdminArea();
  const templates = await prisma.automationRuleTemplate.findMany({
    where: {
      marketplace: true,
      NOT: { ownerUserId: session.user.id },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { owner: { select: { email: true } } },
  });

  if (templates.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Marketplace cross-tenant</CardTitle>
        <CardDescription>Template pubblicati da altri amministratori. Import = copia disattivata sul tuo account.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y text-sm">
          {templates.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  da {t.owner.email} ·{" "}
                  {new Intl.DateTimeFormat("it-IT", { dateStyle: "short" }).format(t.createdAt)}
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
