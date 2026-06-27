import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { authOptions } from "@/lib/auth";
import { requireFullAdmin } from "@/lib/admin-session";
import { DeployStatusPanel } from "@/components/onizuka/deploy-status-panel";
import { ProductionReadinessPanel } from "@/components/onizuka/production-readiness-panel";
import { GoLiveLinks } from "@/app/admin/settings/go-live-links";
import { GoLiveSeedWarning } from "@/components/onizuka/go-live-seed-warning";
import { GoLiveSmokePanel } from "@/components/onizuka/go-live-smoke-panel";
import { GoLiveDiagnosticsPanel } from "@/components/onizuka/go-live-diagnostics-panel";
import { GoLiveDeploySteps } from "@/components/onizuka/go-live-deploy-steps";
import { ErpPartnerBadges } from "@/components/onizuka/erp-partner-badges";
import { OpsClosurePanel } from "@/components/onizuka/ops-closure-panel";
import { GoLiveMissingStepsPanel } from "@/components/onizuka/go-live-missing-steps-panel";

export default async function AdminGoLivePage() {
  const session = await requireFullAdmin();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="onizuka-page-title">Go-live</h1>
        <p className="text-muted-foreground">
          Hub operativo per onizuka.it: checklist variabili, stato deploy e link di verifica post-rilascio.
        </p>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Passi mancanti</CardTitle>
          <CardDescription>
            Vista live della checklist in <strong>PASSI-MANCANTI.md</strong> (obbligatori, consigliati,
            opzionali) — aggiornata da env, DB e account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GoLiveMissingStepsPanel />
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Diagnostica completa</CardTitle>
          <CardDescription>Deploy, DB, password seed e checklist in un colpo solo.</CardDescription>
        </CardHeader>
        <CardContent>
          <GoLiveDiagnosticsPanel />
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Partner ERP (Zucchetti / SAP)</CardTitle>
          <CardDescription>Badge sandbox OAuth + health API per go-live certificazioni.</CardDescription>
        </CardHeader>
        <CardContent>
          <ErpPartnerBadges />
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Go-live Onizuka (codice + ops)</CardTitle>
          <CardDescription>
            Stato integrazioni Sheet, GPU, K8s, Social API, Supabase. Checklist ops: PASSI-MANCANTI.md.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OpsClosurePanel />
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Checklist produzione</CardTitle>
          <CardDescription>Obbligatori e integrazioni opzionali rilevate dal server.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProductionReadinessPanel />
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Stato deploy</CardTitle>
          <CardDescription>Database, storage, cron e avvisi ambiente Vercel/Supabase.</CardDescription>
        </CardHeader>
        <CardContent>
          <DeployStatusPanel />
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Sicurezza account demo</CardTitle>
          <CardDescription>Verifica che le password del seed siano state cambiate.</CardDescription>
        </CardHeader>
        <CardContent>
          <GoLiveSeedWarning />
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Smoke test</CardTitle>
          <CardDescription>Health e readiness dal browser (stesso host).</CardDescription>
        </CardHeader>
        <CardContent>
          <GoLiveSmokePanel />
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Verifiche rapide</CardTitle>
          <CardDescription>Health, webhook, audit. Script: npm run deploy:verify · npm run smoke:prod</CardDescription>
        </CardHeader>
        <CardContent>
          <GoLiveLinks />
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Passi deploy (onizuka.it)</CardTitle>
          <CardDescription>Checklist operativa Hostinger + Vercel + Supabase.</CardDescription>
        </CardHeader>
        <CardContent>
          <GoLiveDeploySteps />
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Documentazione</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/status">Pagina stato pubblico</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/settings">Integrazioni OAuth</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href="https://vercel.com/docs/projects/domains" target="_blank" rel="noreferrer">
              Domini Vercel
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
