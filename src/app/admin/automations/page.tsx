import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { isFullAdmin } from "@/lib/auth-roles";
import { getDeployCapabilities } from "@/lib/deploy-capabilities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const cronJobs: { name: string; path: string; note: string; schedule: string }[] = [
  {
    name: "Notifiche & digest",
    path: "/api/cron/notifications",
    note:
      "Digest, Flow, finance OVERDUE, lead follow-up, intelligence NBA, SLA opportunità, seguito meeting [Meeting], ops weekly (lun). Env: LEAD_FOLLOWUP_CRON, INTELLIGENCE_REFRESH_CRON, OPPORTUNITY_SLA_CRON, MEETING_FOLLOWTHROUGH_CRON (=0 per disabilitare).",
    schedule: "Vercel 06:00 UTC · GHA cron-notifications.yml",
  },
  {
    name: "Reach sequenze",
    path: "/api/cron/reach-sequences",
    note: "Avanza bozze sequenza Reach.",
    schedule: "Vercel 08:00 UTC · GHA cron-reach-sequences.yml",
  },
  {
    name: "Retry webhook",
    path: "/api/cron/webhook-retry",
    note: "Ritenta consegne webhook fallite.",
    schedule: "Vercel ogni 15 min · GHA cron-webhook-retry.yml",
  },
  {
    name: "Coda audit Sheet",
    path: "/api/cron/audit-sheet-queue",
    note: "Elabora job audit da Google Sheet / CSV.",
    schedule: "Solo GitHub Actions · cron-audit-sheet-queue.yml",
  },
  {
    name: "Dedupe training",
    path: "/api/cron/dedupe-training",
    note: "Scan notturno dedupe CRM (GPU opzionale).",
    schedule: "Solo GitHub Actions · cron-dedupe-training.yml",
  },
];

export default async function AutomationsControlPage() {
  const session = await requireAdminArea();
  const caps = getDeployCapabilities();
  const admin = isFullAdmin(session.user.role);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Automation Control Center</h1>
        <p className="text-muted-foreground">
          Panoramica integrazioni esterne, cron Vercel, endpoint n8n e link alle regole in-app (MVP).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Capacità ambiente</CardTitle>
            <CardDescription>Flag da variabili server (non sensibili).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>n8n API: {caps.n8n ? "configurata" : "non configurata"}</p>
            <p>Cron secret: {caps.cron ? "sì" : "no"}</p>
            <p>SMTP: {caps.smtp ? "sì" : "no"}</p>
            <p>Notification bus: {caps.notificationBus ? "sì" : "no"}</p>
            <p>LLM: {caps.llm ? "sì" : "no"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Collegamenti rapidi</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild variant="outline" size="sm" className="justify-start">
              <Link href="/admin/automation-rules">Regole automazione in-app</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="justify-start">
              <Link href="/admin/time">Time tracking interno</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="justify-start">
              <Link href="/refer">Portale pubblico segnalatore (home senza token)</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="justify-start">
              <Link href="/admin/webhooks">Webhook post → n8n</Link>
            </Button>
            {admin ? (
              <Button asChild variant="outline" size="sm" className="justify-start">
                <Link href="/api/admin/n8n/status" target="_blank" rel="noreferrer">
                  Stato API n8n (JSON)
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm" className="justify-start">
              <Link href="/status" target="_blank" rel="noreferrer">
                Status pubblico
              </Link>
            </Button>
            {admin ? (
              <Button asChild variant="outline" size="sm" className="justify-start">
                <Link href="/admin/go-live">Go-live & diagnostica</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cron (Vercel / GitHub Actions)</CardTitle>
          <CardDescription>Header <code className="text-xs">Authorization: Bearer CRON_SECRET</code></CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            {cronJobs.map((job) => (
              <li key={job.path} className="rounded-md border border-border/60 p-3">
                <p className="font-medium">{job.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{job.path}</p>
                <p className="mt-1 text-xs text-muted-foreground">{job.schedule}</p>
                <p className="mt-1 text-xs text-muted-foreground">{job.note}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API n8n in ingresso</CardTitle>
          <CardDescription>Autenticazione con <code className="text-xs">N8N_API_KEY</code></CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="list-inside list-disc space-y-1">
            <li>
              <code className="text-foreground">GET /api/n8n/approved</code> — post approvati per cliente
            </li>
            <li>
              <code className="text-foreground">POST /api/n8n/mark-published</code> — segna pubblicato
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
