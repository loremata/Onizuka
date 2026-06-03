import Link from "next/link";
import { ITALY_TZ } from "@/lib/datetime-it";
import { requireAdminArea } from "@/lib/admin-session";
import { loadActionInbox, type ActionInboxKind } from "@/lib/action-inbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const kindLabel: Record<ActionInboxKind, string> = {
  flow: "Flow",
  outreach: "Reach",
  ticket: "Ticket",
  finance: "Finance",
  audit_queue: "Audit Sheet",
  post: "Contenuti",
  automation: "Automazioni",
  quote: "Preventivo",
};

const priorityClass = {
  high: "border-destructive/40 bg-destructive/5",
  medium: "border-amber-500/30 bg-amber-500/5",
  low: "border-border",
};

export default async function ActionInboxPage() {
  const session = await requireAdminArea();
  const items = await loadActionInbox(session.user.id, 100);
  const high = items.filter((i) => i.priority === "high").length;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin">← Command Center</Link>
        </Button>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Action Inbox</h1>
        <p className="text-muted-foreground">
          Vista unificata: Flow, Reach, ticket, finance, coda audit Sheet, post e automazioni — oltre ai 3 insight del
          Command Center.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{items.length} azioni</CardTitle>
          <CardDescription>
            {high} prioritarie · ordinamento per urgenza e data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inbox vuota. Ottimo lavoro.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${priorityClass[item.priority]}`}
                >
                  <div>
                    <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">
                      {kindLabel[item.kind]}
                    </span>
                    <Link href={item.href} className="font-medium text-primary hover:underline">
                      {item.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {item.createdAt.toLocaleString("it-IT", { timeZone: ITALY_TZ, dateStyle: "short", timeStyle: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
