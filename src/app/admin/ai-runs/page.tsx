import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { isFullAdmin } from "@/lib/auth-roles";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const kindLabel: Record<string, string> = {
  ask: "Ask bar",
  assistant_chat: "Chat assistente",
  memory_rag: "Memoria RAG",
  audit_batch: "Audit batch",
  other: "Altro",
};

export default async function AiRunsPage() {
  const session = await requireAdminArea();
  const admin = isFullAdmin(session.user.role);
  const where = admin ? {} : { ownerUserId: session.user.id };

  const runs = await prisma.aiRun.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 80,
    select: {
      id: true,
      kind: true,
      status: true,
      inputSummary: true,
      outputSummary: true,
      errorDetail: true,
      createdAt: true,
      owner: { select: { email: true } },
    },
  });

  const dateFmt = dateTimeFormatIt({
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/automations">← Automation Control</Link>
      </Button>
      <div>
        <h1 className="onizuka-page-title">Esecuzioni AI</h1>
        <p className="text-muted-foreground">
          Log Ask, chat assistente e altre pipeline LLM (ultime 80).
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Storico</CardTitle>
          <CardDescription>
            {admin ? "Tutti gli admin" : "Solo le tue esecuzioni"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna esecuzione registrata.</p>
          ) : (
            <ul className="divide-y divide-border/60 text-sm">
              {runs.map((r) => (
                <li key={r.id} className="py-3">
                  <p className="font-medium">
                    {kindLabel[r.kind] ?? r.kind} · {r.status} · {dateFmt.format(r.createdAt)}
                  </p>
                  {admin ? (
                    <p className="text-xs text-muted-foreground">{r.owner.email}</p>
                  ) : null}
                  {r.inputSummary ? (
                    <p className="mt-1 text-xs text-muted-foreground">In: {r.inputSummary}</p>
                  ) : null}
                  {r.outputSummary ? (
                    <p className="text-xs text-muted-foreground">Out: {r.outputSummary}</p>
                  ) : null}
                  {r.errorDetail ? (
                    <p className="text-xs text-destructive">{r.errorDetail}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
