import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AutomationRuleEditForm } from "../../automation-rule-edit-form";
import { AutomationRevisionRestore } from "../../automation-revision-restore";
import { AutomationSaveTemplateForm } from "../../automation-save-template-form";

export default async function EditAutomationRulePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminArea();
  const { id } = await params;

  const rule = await prisma.automationRule.findFirst({
    where: { id, ownerUserId: session.user.id },
  });
  if (!rule) notFound();

  const revisions = await prisma.automationRuleRevision.findMany({
    where: { ruleId: id },
    orderBy: { version: "desc" },
    take: 8,
    select: { version: true, createdAt: true },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/automation-rules">← Regole</Link>
        </Button>
        <h1 className="mt-2 onizuka-page-title">Modifica regola</h1>
        <p className="text-muted-foreground">
          {rule.name} · v{rule.ruleVersion} ·{" "}
          <a
            className="text-primary hover:underline"
            href={`/api/admin/automation-rules/${id}/export`}
            target="_blank"
            rel="noreferrer"
          >
            Export JSON
          </a>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configurazione</CardTitle>
        </CardHeader>
        <CardContent>
          <AutomationRuleEditForm rule={rule} />
          <div className="mt-4 border-t border-dashed pt-3">
            <AutomationSaveTemplateForm ruleId={id} />
          </div>
        </CardContent>
      </Card>

      {revisions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revisioni salvate</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="list-disc pl-5">
              {revisions.map((r) => (
                <li key={r.version} className="flex items-center justify-between gap-2">
                  <span>
                    v{r.version} ·{" "}
                    {dateTimeFormatIt({ dateStyle: "short", timeStyle: "short" }).format(r.createdAt)}
                  </span>
                  <AutomationRevisionRestore ruleId={id} version={r.version} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
