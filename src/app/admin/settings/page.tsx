import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { isFullAdmin } from "@/lib/auth-roles";
import { WorkspaceDatabasePanel } from "@/components/onizuka/workspace-database-panel";
import { AgencyPartnerCertPanel } from "@/components/onizuka/agency-partner-cert-panel";
import { getAgencyPartnerSettings } from "@/lib/agency-partner-settings";
import { isValidIanaTimeZone } from "@/lib/day-bounds";
import { recapTimezoneSelectOptions } from "@/lib/recap-timezones";
import { prisma } from "@/lib/prisma";
import { RecapTimezoneForm } from "./recap-timezone-form";
import { NotifyDigestForm } from "./notify-digest-form";
import { DeployStatusPanel } from "@/components/onizuka/deploy-status-panel";
import { ProductionReadinessPanel } from "@/components/onizuka/production-readiness-panel";
import { GoLiveLinks } from "./go-live-links";
import { Suspense } from "react";
import { IntegrationsConnect } from "@/components/onizuka/integrations-connect";
import { IntegrationsStatus } from "@/components/onizuka/integrations-status";
import { WhatsAppIntegrationCard } from "@/components/onizuka/whatsapp-integration-card";
import { WhatsAppInboxPanel } from "@/components/onizuka/whatsapp-inbox-panel";
import { isWhatsAppConfigured } from "@/lib/whatsapp-cloud";
import Link from "next/link";

const roadmapBullets = [
  "Ruoli granulari e policy memoria sensibile",
  "Fatturazione e cashflow collegati a Finance",
  "TTS cloud provider (oggi: Web Speech nel browser)",
];

export default async function AdminSettingsPage() {
  const session = await requireAdminArea();

  const savedTz = session.user.timeZone?.trim() ?? "";

  const selectOptions = [...recapTimezoneSelectOptions];
  if (savedTz && isValidIanaTimeZone(savedTz) && !selectOptions.some((o) => o.value === savedTz)) {
    selectOptions.splice(1, 0, { value: savedTz, label: `${savedTz} (attuale)` });
  }
  const defaultValue = savedTz && isValidIanaTimeZone(savedTz) ? savedTz : "";

  const userPrefs = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { notifyDigestEmail: true },
  });

  const admin = isFullAdmin(session.user.role);
  const partnerSettings = await getAgencyPartnerSettings();
  const workspaces = admin
    ? await prisma.workspace.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          databaseSlug: true,
          databaseUrl: true,
          databaseProvisionedAt: true,
          databaseCloudProvider: true,
          databaseCloudRef: true,
        },
      })
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="onizuka-page-title">Impostazioni</h1>
        <p className="text-muted-foreground">
          Preferenze operative, integrazioni OAuth e hub go-live in menu laterale.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Sicurezza account</CardTitle>
          <CardDescription>Password di accesso al pannello admin.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/admin/account/password" className="text-sm text-primary hover:underline">
            Cambia password
          </Link>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Fuso orario recap</CardTitle>
          <CardDescription>
            Salvato sul tuo account: vale su tutti i dispositivi dopo il login. Se non impostato, si usa{" "}
            <span className="font-mono">ONIZUKA_RECAP_TIMEZONE</span> e in ultima istanza la mezzanotte locale del
            server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecapTimezoneForm options={selectOptions} defaultValue={defaultValue} />
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Notifiche email</CardTitle>
          <CardDescription>Digest riepilogativo giornaliero via cron o invio manuale da /admin/notifications.</CardDescription>
        </CardHeader>
        <CardContent>
          <NotifyDigestForm defaultEnabled={userPrefs?.notifyDigestEmail !== false} />
        </CardContent>
      </Card>

      {admin ? (
        <WorkspaceDatabasePanel
          workspaces={workspaces.map((w) => ({
            id: w.id,
            name: w.name,
            slug: w.slug,
            databaseSlug: w.databaseSlug,
            hasDatabaseUrl: Boolean(w.databaseUrl?.trim()),
            databaseProvisionedAt: w.databaseProvisionedAt?.toISOString() ?? null,
            databaseCloudProvider: w.databaseCloudProvider,
            databaseCloudRef: w.databaseCloudRef,
          }))}
        />
      ) : null}

      {admin ? (
        <AgencyPartnerCertPanel
          initial={{
            zucchettiOfficial: partnerSettings.zucchettiOfficial,
            sapOfficial: partnerSettings.sapOfficial,
            zucchettiPartnerRef: partnerSettings.zucchettiPartnerRef,
            sapPartnerRef: partnerSettings.sapPartnerRef,
            zucchettiContractDriveUrl: partnerSettings.zucchettiContractDriveUrl,
            sapContractDriveUrl: partnerSettings.sapContractDriveUrl,
            legalArchiveNotes: partnerSettings.legalArchiveNotes,
            contractSignedAt: partnerSettings.contractSignedAt?.toISOString() ?? null,
          }}
        />
      ) : null}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Checklist produzione</CardTitle>
          <CardDescription>Variabili obbligatorie e opzionali rilevate dal server.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProductionReadinessPanel />
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Go-live onizuka.it</CardTitle>
          <CardDescription>Smoke test rapidi dopo il deploy su Vercel.</CardDescription>
        </CardHeader>
        <CardContent>
          <GoLiveLinks />
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Stato deploy</CardTitle>
          <CardDescription>
            Controllo ambiente Vercel/Supabase (variabili, database, storage). Per onizuka.it vedi anche{" "}
            <span className="font-mono">docs/DEPLOY.md</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeployStatusPanel />
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Integrazioni</CardTitle>
          <CardDescription>Stato credenziali e collegamento OAuth Google Calendar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <IntegrationsStatus />
          <Suspense fallback={<p className="text-sm text-muted-foreground">Collegamenti…</p>}>
            <IntegrationsConnect />
          </Suspense>
          <WhatsAppIntegrationCard configured={isWhatsAppConfigured()} />
        </CardContent>
      </Card>

      <WhatsAppInboxPanel />
      <p className="text-sm">
        <a href="/admin/whatsapp" className="text-primary hover:underline">
          Inbox operatore WhatsApp (assegnazione + risposta + catalogo template) →
        </a>
      </p>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Roadmap impostazioni</CardTitle>
          <CardDescription>Modulo in costruzione secondo la specifica master.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
            {roadmapBullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
