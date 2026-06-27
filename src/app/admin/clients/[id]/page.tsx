import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { isFullAdmin } from "@/lib/auth-roles";
import { ClientPreviewButton } from "@/components/admin/client-preview-button";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clientStatusLabel } from "@/lib/crm-client-status";
import { setClientRelationshipState } from "../actions";
import { ClientRetailSnapshotCard } from "../client-retail-snapshot-card";
import { ClientDigitalSnapshotCard } from "../client-digital-snapshot-card";
import { opportunityStatusLabel } from "@/lib/crm-opportunity";
import { platformLabel } from "@/lib/platform-label";
import { buildClientTimeline, timelineKindLabel } from "@/lib/client-timeline";
import { computeClientHealthScore } from "@/lib/client-health-score";
import { computeCustomerScore, CUSTOMER_BAND_LABEL } from "@/lib/client-customer-scoring";
import { ensureCommercialCatalogSeeded } from "@/lib/commercial-catalog-seed";
import { loadClientAssetCommercialSummary } from "@/lib/client-asset-commercial";
import { loadClientServiceGaps } from "@/lib/client-commercial-gaps";
import { ClientServicesForm } from "./commercial-services/client-services-form";
import { ClientDigitalAuditButton } from "./client-digital-audit-button";
import { ClientMilestonesPanel } from "./client-milestones-panel";
import { ClientOnboardingPanel } from "./client-onboarding-panel";
import { ClientCommitmentsPanel } from "./client-commitments-panel";
import { ClientTagsAttributes } from "@/components/onizuka/client-tags-attributes";
import { ensureDefaultOnboardingItems } from "@/lib/client-onboarding";
import { GbpReviewsPanel } from "./gbp-reviews-panel";
import { ClientRetailContractsCard } from "../client-retail-contracts-card";
import { loadClient360Nav } from "@/lib/client-360-nav";
import { ClientHubNav } from "@/components/onizuka/client-hub-nav";
import { ClientSchedaTabs, ClientSchedaPanel } from "@/components/onizuka/client-scheda-tabs";
import { Client360CommercialPanels } from "@/components/onizuka/client-360-commercial";
import { loadClient360Profile } from "@/lib/client-360-profile";
import { loadAuditCommercialSummaryForClient } from "@/lib/load-audit-commercial-summary";
import { AuditCommercialSummaryCard } from "@/components/onizuka/audit-commercial-summary-card";
import { clientKindLabel } from "@/lib/client-kind";
import { Select } from "@/components/ui/select";

const priorityLabel: Record<string, string> = {
  LOW: "Bassa",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export default async function ClientOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAdminArea();

  const { id } = await params;
  const sp = await searchParams;
  const gbpAssetId = typeof sp.gbpAsset === "string" ? sp.gbpAsset : undefined;
  // Query iniziali indipendenti: eseguite in parallelo (prima erano 6 await in cascata).
  // L'onboarding va popolato (ensure) PRIMA della sua findMany → catena dedicata.
  const onboardingPromise = ensureDefaultOnboardingItems(id, session.user.id).then(() =>
    prisma.clientOnboardingItem.findMany({
      where: { clientId: id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        label: true,
        status: true,
        dueDate: true,
        completedAt: true,
      },
    }),
  );
  const [assetCommercial, clientOnboarding, clientCommitments, clientMilestones, client] = await Promise.all([
    loadClientAssetCommercialSummary(id, session.user.id),
    onboardingPromise,
    prisma.clientCommitment.findMany({
      where: { clientId: id },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        ownerName: true,
        note: true,
        dueDate: true,
        status: true,
      },
    }),
    prisma.clientMilestone.findMany({
      where: { clientId: id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        targetDate: true,
        completedAt: true,
        visibleToClient: true,
      },
    }),
    prisma.client.findUnique({
    where: { id },
    include: {
      attributes: { select: { key: true, value: true }, orderBy: { key: "asc" } },
      _count: {
        select: {
          users: true,
          posts: true,
          flowTasks: true,
          memoryItems: true,
          opportunities: true,
          assets: true,
          contacts: true,
        },
      },
      users: {
        orderBy: { email: "asc" },
        select: { id: true, email: true, name: true },
      },
      contacts: {
        orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
        take: 6,
        select: { id: true, name: true, role: true, email: true, isPrimary: true },
      },
      flowTasks: {
        where: { ownerUserId: session.user.id },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: { id: true, title: true, status: true, priority: true, dueDate: true, updatedAt: true },
      },
      memoryItems: {
        where: { ownerUserId: session.user.id },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: { id: true, title: true, scope: true, updatedAt: true },
      },
      opportunities: {
        where: { ownerUserId: session.user.id },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          estimatedValue: true,
          updatedAt: true,
          asset: { select: { name: true } },
        },
      },
      assets: {
        orderBy: { name: "asc" },
        take: 12,
        select: {
          id: true,
          name: true,
          slug: true,
          platform: true,
          profileUrl: true,
          gbpLocationName: true,
          updatedAt: true,
        },
      },
      posts: {
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: { id: true, captionText: true, status: true, updatedAt: true },
      },
    },
    }),
  ]);

  if (!client) notFound();

  // Catalogo: solo un count economico; semina solo se mancante (non più 34 scritture/load).
  await ensureCommercialCatalogSeeded();
  const now = new Date();
  const [
    catalog,
    clientLinks,
    serviceGaps,
    openTickets,
    overdueFinance,
    overdueFlowTasks,
    client360Nav,
    digitalAudits,
    outreachDrafts,
    recentQuotes,
    recentTickets,
    client360Profile,
    auditCommercialSummary,
    activeRetailCount,
  ] = await Promise.all([
      prisma.commercialService.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { ecosystemBrand: { select: { name: true } } },
      }),
      prisma.clientCommercialService.findMany({ where: { clientId: id } }),
      loadClientServiceGaps(id),
      prisma.clientTicket.count({
        where: { clientId: id, status: { in: ["OPEN", "IN_PROGRESS"] } },
      }),
      prisma.financeEntry.count({
        where: { clientId: id, ownerUserId: session.user.id, status: "OVERDUE" },
      }),
      prisma.flowTask.count({
        where: {
          relatedClientId: id,
          ownerUserId: session.user.id,
          status: { not: "DONE" },
          dueDate: { lt: now },
        },
      }),
      loadClient360Nav(id, session.user.id),
      prisma.digitalAudit.findMany({
        where: { clientId: id, ownerUserId: session.user.id },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: { id: true, businessName: true, overallScore: true, updatedAt: true },
      }),
      prisma.outreachDraft.findMany({
        where: { clientId: id, ownerUserId: session.user.id },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: { id: true, subject: true, status: true, updatedAt: true },
      }),
      prisma.opportunityQuote.findMany({
        where: { ownerUserId: session.user.id, opportunity: { clientId: id } },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: { id: true, title: true, status: true, updatedAt: true, opportunityId: true },
      }),
      prisma.clientTicket.findMany({
        where: { clientId: id },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: { id: true, title: true, status: true, updatedAt: true },
      }),
      loadClient360Profile(id, session.user.id),
      loadAuditCommercialSummaryForClient(id, session.user.id),
      prisma.clientRetailContract.count({ where: { clientId: id, status: "ACTIVE" } }),
    ]);
  const linkByServiceId = new Map(clientLinks.map((l) => [l.commercialServiceId, l]));
  const serviceRows = catalog.map((s) => {
    const link = linkByServiceId.get(s.id);
    return {
      slug: s.slug,
      name: s.name,
      category: s.category,
      brandName: s.ecosystemBrand?.name ?? null,
      active: link?.active ?? false,
      notes: link?.notes ?? "",
      inactiveReason: link?.inactiveReason ?? "",
    };
  });

  const oppForScore = client.opportunities.map((o) => ({
    status: o.status,
    estimatedValue: o.estimatedValue,
  }));
  const healthScore = computeClientHealthScore({
    ...client,
    opportunities: oppForScore,
    openTickets,
    overdueFinance,
    overdueFlowTasks,
    _count: { ...client._count, tickets: openTickets },
  });
  const healthBandLabel =
    healthScore.band === "healthy" ? "Solido" : healthScore.band === "watch" ? "Da monitorare" : "A rischio";

  // Customer scoring composito (6 dimensioni) — affianca health/audit score.
  // activeRetailCount è caricato nel Promise.all sopra.
  const wonValueEur = oppForScore
    .filter((o) => o.status === "WON")
    .reduce((sum, o) => sum + (o.estimatedValue ? Number(o.estimatedValue.toString()) : 0), 0);
  const activeCategoryCount = new Set(serviceRows.filter((r) => r.active).map((r) => r.category)).size;
  const monthsSinceActivity = Math.max(
    0,
    Math.floor((now.getTime() - client.updatedAt.getTime()) / (1000 * 60 * 60 * 24 * 30)),
  );
  const customerScore = computeCustomerScore({
    status: client.status,
    kind: client.kind,
    macroCategory: client.clientMacroCategory,
    hasVat: Boolean(client.vatNumber?.trim()),
    wonValueEur,
    activeRecurringCount: activeRetailCount,
    activeCategoryCount,
    monthsSinceActivity,
    overdueFinance,
    openTickets,
    contactsCount: client._count.contacts,
  });

  const opportunitiesRecent = client.opportunities.slice(0, 12);

  const timeline = buildClientTimeline(client.id, {
    flowTasks: client.flowTasks,
    memoryItems: client.memoryItems,
    opportunities: opportunitiesRecent,
    posts: client.posts,
    assets: client.assets,
    digitalAudits,
    outreachDrafts,
    quotes: recentQuotes,
    tickets: recentTickets,
  });

  const timelineDateFmt = dateTimeFormatIt({ dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/clients">← Clienti</Link>
          </Button>
          <div>
            <h1 className="onizuka-page-title">{client.companyName}</h1>
            <p className="text-muted-foreground">
              Slug <span className="font-mono text-foreground">{client.slug}</span> · {client.contactEmail}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Stato: <span className="text-foreground">{clientStatusLabel[client.status]}</span>
              {client.kind ? (
                <>
                  {" · "}
                  <span className="text-foreground">{clientKindLabel[client.kind]}</span>
                </>
              ) : null}
              {client.vatNumber ? (
                <>
                  {" · P.IVA "}
                  <span className="font-mono text-foreground">{client.vatNumber}</span>
                </>
              ) : null}
              {client.fiscalCode ? (
                <>
                  {" · CF "}
                  <span className="font-mono text-foreground">{client.fiscalCode}</span>
                </>
              ) : null}
            </p>
            <form action={setClientRelationshipState.bind(null, client.id)} className="mt-2 flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Relazione:</span>
              <Select
                name="relationshipState"
                aria-label="Stato relazione cliente"
                defaultValue={client.relationshipState}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="CLIENTE">Cliente</option>
                <option value="LEAD">Lead / Prospect</option>
                <option value="EX_CLIENTE">Ex cliente</option>
              </Select>
              <Button type="submit" size="sm" variant="outline">Aggiorna stato</Button>
            </form>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/clients/${client.id}/assets/new`}>Nuovo asset</Link>
          </Button>
          {isFullAdmin(session.user.role) ? <ClientPreviewButton clientId={client.id} /> : null}
        </div>
      </div>

      <ClientSchedaTabs
        tabs={[
          { id: "panoramica", label: "Panoramica" },
          { id: "commerciale", label: "Commerciale" },
          { id: "attivita", label: "Attività" },
          { id: "caring", label: "Caring & progetto" },
        ]}
      >
        <ClientSchedaPanel id="panoramica">
      <ClientHubNav items={client360Nav} />

      {client360Profile ? (
        <Client360CommercialPanels clientId={client.id} profile={client360Profile} />
      ) : null}

      <AuditCommercialSummaryCard summary={auditCommercialSummary} />

      <ClientRetailSnapshotCard clientId={client.id} />

      <ClientDigitalSnapshotCard clientId={client.id} />

      {/* Punteggio cliente unificato: due assi indipendenti (prima 3 score separati e contraddittori). */}
      <Card>
        <CardHeader>
          <CardTitle>Punteggio cliente</CardTitle>
          <CardDescription>Due assi indipendenti: quanto vale e quanto sta bene la relazione.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valore commerciale</p>
              <p className="text-3xl font-bold">
                {customerScore.score}/100{" "}
                <span className="text-base font-normal text-muted-foreground">({CUSTOMER_BAND_LABEL[customerScore.band]})</span>
              </p>
              <ul className="mt-2 grid gap-1 text-xs text-muted-foreground">
                {customerScore.factors.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Salute relazione</p>
              <p className="text-3xl font-bold">
                {healthScore.score}/100{" "}
                <span className="text-base font-normal text-muted-foreground">({healthBandLabel})</span>
              </p>
              {healthScore.nextAction ? (
                <p className="mt-2 text-xs font-medium text-foreground">Prossima azione: {healthScore.nextAction}</p>
              ) : null}
              <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                {healthScore.factors.slice(0, 4).map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3">
            <Button asChild variant="link" className="h-auto p-0 text-xs">
              <Link href="/admin/audit/digital">Audit digitali</Link>
            </Button>
            <ClientDigitalAuditButton clientId={client.id} />
          </div>
        </CardContent>
      </Card>

        </ClientSchedaPanel>
        <ClientSchedaPanel id="commerciale">
      <ClientRetailContractsCard clientId={client.id} ownerUserId={session.user.id} />

      <GbpReviewsPanel
        ownerUserId={session.user.id}
        clientId={client.id}
        assets={client.assets}
        selectedAssetId={gbpAssetId}
      />

      <Card>
        <CardHeader>
          <CardTitle>Servizi attivi / mancanti</CardTitle>
          <CardDescription>
            Catalogo Onizuka: {serviceRows.filter((r) => r.active).length} attivi · {serviceGaps.length} gap upsell
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClientServicesForm clientId={client.id} services={serviceRows} />
          {serviceGaps.length > 0 ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Upsell suggeriti: {serviceGaps.slice(0, 5).map((g) => g.serviceName).join(", ")}
              {serviceGaps.length > 5 ? "…" : ""}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tag e attributi</CardTitle>
          <CardDescription>Etichette e dati liberi per segmentare (filtrabili in Database / Segmenti).</CardDescription>
        </CardHeader>
        <CardContent>
          <ClientTagsAttributes clientId={client.id} tags={client.tags} attributes={client.attributes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Anagrafica e contesto</CardTitle>
          <CardDescription>Dati commerciali e note (estensione verso scheda 360°).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Partita IVA</p>
            <p>{client.vatNumber ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Conto PDC gestionale</p>
            <p className="font-mono text-xs">{client.accountingCode ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Telefono</p>
            <p>{client.phone ?? "—"}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">Sito web</p>
            {client.website ? (
              <a
                className="text-primary underline-offset-4 hover:underline"
                href={
                  client.website.startsWith("http://") || client.website.startsWith("https://")
                    ? client.website
                    : `https://${client.website}`
                }
                target="_blank"
                rel="noreferrer"
              >
                {client.website}
              </a>
            ) : (
              <p>—</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">Sede</p>
            <p>
              {[client.address, client.city, client.country].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">Note</p>
            <p className="whitespace-pre-wrap text-muted-foreground">{client.notes?.trim() ? client.notes : "—"}</p>
          </div>
        </CardContent>
      </Card>

        </ClientSchedaPanel>
        <ClientSchedaPanel id="attivita">
      <Card>
        <CardHeader>
          <CardTitle>Timeline attività</CardTitle>
          <CardDescription>
            Ultimi aggiornamenti su task, memoria, opportunità, post e asset (max 20 eventi).
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {timeline.length === 0 ? (
            <p className="text-muted-foreground">Nessuna attività recente per questo cliente.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {timeline.map((e) => (
                <li key={e.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between">
                  <div>
                    <Link className="font-medium text-primary hover:underline" href={e.href}>
                      {e.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {timelineKindLabel[e.kind]}
                      {e.subtitle ? ` · ${e.subtitle}` : ""}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground" dateTime={e.at.toISOString()}>
                    {timelineDateFmt.format(e.at)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Utenti portale</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{client._count.users}</p>
            {client.users.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {client.users.map((u) => (
                  <li key={u.id}>
                    <span className="text-foreground">{u.email}</span>
                    {u.name ? ` · ${u.name}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Nessun utente collegato.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Post</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{client._count.posts}</p>
            <Button asChild variant="link" className="h-auto px-0 text-xs">
              <Link href={`/admin/posts?clientId=${client.id}`}>Apri contenuti</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Task collegati</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{client._count.flowTasks}</p>
            <Button asChild variant="link" className="h-auto px-0 text-xs">
              <Link href="/admin/flow">Apri Flow</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Memorie</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{client._count.memoryItems}</p>
            <Button asChild variant="link" className="h-auto px-0 text-xs">
              <Link href="/admin/memory">Apri memoria</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Opportunità</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{client._count.opportunities}</p>
            <Button asChild variant="link" className="h-auto px-0 text-xs">
              <Link href="/admin/crm/opportunities">Apri CRM</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Referenti</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{client._count.contacts}</p>
            <Button asChild variant="link" className="h-auto px-0 text-xs">
              <Link href={`/admin/clients/${client.id}/contacts`}>Gestisci referenti</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Asset</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{client._count.assets}</p>
            <Button asChild variant="link" className="h-auto px-0 text-xs">
              <Link href={`/admin/clients/${client.id}/assets/new`}>Nuovo asset</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

        </ClientSchedaPanel>
        <ClientSchedaPanel id="caring">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <CardTitle>Referenti commerciali</CardTitle>
            <CardDescription>Contatti operativi lato cliente (non necessariamente account portale).</CardDescription>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href={`/admin/clients/${client.id}/contacts`}>Vedi tutti</Link>
          </Button>
        </CardHeader>
        <CardContent className="text-sm">
          {client.contacts.length === 0 ? (
            <p className="text-muted-foreground">Nessun referente. Aggiungine uno dalla pagina dedicata.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {client.contacts.map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <div>
                    <span className="font-medium">
                      {c.name}
                      {c.isPrimary ? (
                        <span className="ml-2 text-xs font-normal text-primary">(principale)</span>
                      ) : null}
                    </span>
                    <p className="text-xs text-muted-foreground">{[c.role, c.email].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="h-8 shrink-0 px-2 text-xs">
                    <Link href={`/admin/clients/${client.id}/contacts/${c.id}/edit`}>Modifica</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Task recenti</CardTitle>
            <CardDescription>Flow collegati a questo cliente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {client.flowTasks.length === 0 ? (
              <p className="text-muted-foreground">Nessun task collegato.</p>
            ) : (
              <ul className="space-y-2">
                {client.flowTasks.map((t) => (
                  <li key={t.id} className="flex flex-col border-b border-border/50 pb-2 last:border-0">
                    <span className="font-medium">{t.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.status} · priorità {priorityLabel[t.priority] ?? t.priority}
                      {t.dueDate
                        ? ` · scad. ${dateTimeFormatIt({ dateStyle: "short" }).format(t.dueDate)}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Memoria collegata</CardTitle>
            <CardDescription>Ultime voci con questo cliente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {client.memoryItems.length === 0 ? (
              <p className="text-muted-foreground">Nessuna memoria collegata.</p>
            ) : (
              <ul className="space-y-2">
                {client.memoryItems.map((m) => (
                  <li key={m.id}>
                    <Link className="font-medium text-primary hover:underline" href={`/admin/memory/${m.id}/edit`}>
                      {m.title}
                    </Link>
                    <span className="text-xs text-muted-foreground"> — {m.scope}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Opportunità</CardTitle>
            <CardDescription>Trattative collegate a questo cliente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {opportunitiesRecent.length === 0 ? (
              <p className="text-muted-foreground">Nessuna opportunità.</p>
            ) : (
              <ul className="space-y-2">
                {opportunitiesRecent.map((o) => (
                  <li key={o.id}>
                    <Link
                      className="font-medium text-primary hover:underline"
                      href={`/admin/crm/opportunities/${o.id}/edit`}
                    >
                      {o.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      — {opportunityStatusLabel[o.status]}
                      {o.estimatedValue != null ? ` · €${String(o.estimatedValue)}` : ""}
                      {o.asset ? ` · ${o.asset.name}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Onboarding</CardTitle>
            <CardDescription>Checklist avvio cliente (materiali, kickoff, accessi).</CardDescription>
          </CardHeader>
          <CardContent>
            <ClientOnboardingPanel clientId={id} items={clientOnboarding} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Impegni interni</CardTitle>
            <CardDescription>Promesse e commitment verso il cliente.</CardDescription>
          </CardHeader>
          <CardContent>
            <ClientCommitmentsPanel clientId={id} commitments={clientCommitments} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Milestone progetto</CardTitle>
          <CardDescription>Visibili nel portale cliente (Progetti) se flag attivo.</CardDescription>
        </CardHeader>
        <CardContent>
          <ClientMilestonesPanel clientId={id} milestones={clientMilestones} />
        </CardContent>
      </Card>

      {assetCommercial.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pipeline per asset</CardTitle>
            <CardDescription>Opportunità collegate a ciascun canale digitale.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="divide-y divide-border/60">
              {assetCommercial.map((row) => (
                <li key={row.assetId} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="font-medium">
                    {row.assetName}
                    {row.platform
                      ? ` · ${platformLabel[row.platform as keyof typeof platformLabel]}`
                      : ""}
                  </span>
                  <span className="text-muted-foreground">
                    {row.openOpportunities} opp. aperte · € {row.pipelineEur} · vinte € {row.wonEur}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <CardTitle>Catalogo asset</CardTitle>
            <CardDescription>Canali digitali collegati al cliente (social, GBP, brand).</CardDescription>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link href={`/admin/clients/${client.id}/assets/new`}>Aggiungi asset</Link>
          </Button>
        </CardHeader>
        <CardContent className="text-sm">
          {client.assets.length === 0 ? (
            <p className="text-muted-foreground">Nessun asset definito.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {client.assets.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <Link
                    className="font-medium text-primary hover:underline"
                    href={`/admin/clients/${client.id}/assets/${a.id}/edit`}
                  >
                    {a.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    <span className="font-mono">{a.slug}</span>
                    {a.platform ? ` · ${platformLabel[a.platform]}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
        </ClientSchedaPanel>
      </ClientSchedaTabs>
    </div>
  );
}
