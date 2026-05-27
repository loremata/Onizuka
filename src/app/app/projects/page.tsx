import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAppClientContext } from "@/lib/app-client-session";
import { loadClientProjectProgress } from "@/lib/client-project-progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ClientProjectsPage() {
  const ctx = await requireAppClientContext();
  const progress = await loadClientProjectProgress(ctx.clientId);
  const dateFmt = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="onizuka-page-title">Avanzamento progetti</h1>
        <p className="text-muted-foreground">
          Sintesi contenuti approvati, programmazione e supporto (ultimi 90 giorni).
        </p>
        <Link href="/app/dashboard" className="mt-2 inline-block text-sm text-primary hover:underline">
          ← Dashboard
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Milestone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {progress.milestonesCompleted}/{progress.milestonesTotal}
            </p>
            <p className="text-xs text-muted-foreground">completate</p>
          </CardContent>
        </Card>
        {progress.onboardingTotal > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Onboarding</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {progress.onboardingCompleted}/{progress.onboardingTotal}
              </p>
              <p className="text-xs text-muted-foreground">voci completate</p>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Post approvati (90g)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{progress.approvedLast90}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In programma (30g)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{progress.scheduledUpcoming}</p>
            <Link href="/app/plan" className="text-xs text-primary hover:underline">
              Piano editoriale →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ticket aperti</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{progress.openTickets}</p>
            <Link href="/app/tickets" className="text-xs text-primary hover:underline">
              Supporto →
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Timeline attività</CardTitle>
          <CardDescription>Ultimi eventi su contenuti e ticket.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {progress.milestones.length === 0 ? (
            <p className="text-muted-foreground">Nessuna attività recente da mostrare.</p>
          ) : (
            <ul className="space-y-3">
              {progress.milestones.map((m) => (
                <li key={m.id} className="flex flex-col gap-0.5 border-l-2 border-primary/40 pl-3">
                  <Link className="font-medium text-primary hover:underline" href={m.href}>
                    {m.label}
                  </Link>
                  <span className="text-xs text-muted-foreground">{dateFmt.format(m.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
