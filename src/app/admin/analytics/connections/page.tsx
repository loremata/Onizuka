import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { runWithDb } from "@/lib/with-db";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { SocialHubTabs } from "@/components/onizuka/social-hub-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dateTimeFormatIt } from "@/lib/datetime-it";
import { buildGa4AuthUrl, isGa4Connected, isGa4OAuthConfigured } from "@/lib/ga4-oauth";
import { deleteConnection, syncConnection } from "./actions";
import { Ga4ConnectionForm } from "./ga4-connection-form";
import { AdsConnectionForm } from "./ads-connection-form";

type Props = { searchParams: Record<string, string | string[] | undefined> };

export default async function AnalyticsConnectionsPage({ searchParams }: Props) {
  const session = await requireAdminArea();
  const notice = typeof searchParams.ga4 === "string" ? searchParams.ga4 : "";

  const loaded = await runWithDb(() =>
    Promise.all([
      prisma.client.findMany({
        orderBy: [{ isOwnBrand: "desc" }, { companyName: "asc" }],
        select: { id: true, companyName: true, isOwnBrand: true },
      }),
      prisma.analyticsConnection.findMany({
        where: { source: "GA4" },
        orderBy: { createdAt: "desc" },
        include: { client: { select: { companyName: true } } },
      }),
      prisma.analyticsConnection.findMany({
        where: { source: { in: ["META_ADS", "GOOGLE_ADS"] } },
        orderBy: { createdAt: "desc" },
        include: { client: { select: { companyName: true } } },
      }),
    ])
  );

  if (!loaded.ok) {
    return (
      <div className="space-y-6">
        <SocialHubTabs />
        <h1 className="onizuka-page-title">Connessioni Analytics</h1>
        <DbUnavailableBanner />
      </div>
    );
  }

  const [clients, connections, adsConnections] = loaded.data;
  const adsLabel: Record<string, string> = { META_ADS: "Meta Ads", GOOGLE_ADS: "Google Ads" };
  const googleConnected = await isGa4Connected(session.user.id);
  const oauthConfigured = isGa4OAuthConfigured();
  const authUrl = oauthConfigured ? buildGa4AuthUrl("ga4") : null;
  const dateFmt = dateTimeFormatIt({ dateStyle: "short", timeStyle: "short" });

  return (
    <div className="space-y-6">
      <SocialHubTabs />
      <div>
        <h1 className="onizuka-page-title">Connessioni Analytics · Google Analytics 4</h1>
        <p className="text-muted-foreground">
          Collega il tuo account Google, poi mappa una property GA4 a un cliente/brand. I dati del sito compaiono
          nel <Link href="/admin/analytics" className="text-primary hover:underline">cruscotto Analytics</Link>.
        </p>
      </div>

      {notice === "connected" && (
        <div className="rounded-md bg-primary/10 p-3 text-sm text-primary">Google Analytics collegato ✓</div>
      )}
      {notice === "error" && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Collegamento a Google Analytics non riuscito. Riprova.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>1 · Account Google</CardTitle>
          <CardDescription>Autorizza la lettura di Google Analytics (permesso sola lettura).</CardDescription>
        </CardHeader>
        <CardContent>
          {!oauthConfigured ? (
            <p className="text-sm text-muted-foreground">
              OAuth Google non configurato: imposta <code>GOOGLE_ANALYTICS_CLIENT_ID/SECRET</code> (o riusa quelli GBP/Calendar).
            </p>
          ) : googleConnected ? (
            <p className="text-sm">
              <span className="rounded bg-primary/10 px-2 py-0.5 text-primary">Collegato ✓</span>{" "}
              {authUrl && (
                <a href={authUrl} className="ml-2 text-primary hover:underline">
                  Ricollega
                </a>
              )}
            </p>
          ) : (
            authUrl && (
              <Button asChild size="sm">
                <a href={authUrl}>Collega Google Analytics</a>
              </Button>
            )
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2 · Collega una property a un cliente</CardTitle>
          <CardDescription>L&apos;ID property è nel formato 123456789 (GA4 → Amministra → Impostazioni property).</CardDescription>
        </CardHeader>
        <CardContent>
          <Ga4ConnectionForm clients={clients} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Property collegate ({connections.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {connections.length === 0 ? (
            <p className="text-muted-foreground">Nessuna property collegata.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {connections.map((c) => (
                <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {c.displayName} <span className="text-muted-foreground">· {c.client.companyName}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.externalId} ·{" "}
                      {c.lastSyncAt ? `sync ${dateFmt.format(c.lastSyncAt)}` : "mai sincronizzato"}
                      {c.lastError ? <span className="text-destructive"> · {c.lastError}</span> : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={syncConnection}>
                      <input type="hidden" name="id" value={c.id} />
                      <Button type="submit" size="sm" variant="secondary">Sincronizza ora</Button>
                    </form>
                    <form action={deleteConnection}>
                      <input type="hidden" name="id" value={c.id} />
                      <Button type="submit" size="sm" variant="destructive">Elimina</Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Advertising · Meta Ads &amp; Google Ads</CardTitle>
          <CardDescription>
            Collega un account pubblicitario per aggregare spesa, click, impression, conversioni, CPC/CPM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AdsConnectionForm clients={clients} />
          {adsConnections.length > 0 && (
            <ul className="divide-y divide-border/60 border-t pt-2">
              {adsConnections.map((c) => (
                <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {c.displayName}{" "}
                      <span className="text-muted-foreground">· {adsLabel[c.source]} · {c.client.companyName}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.externalId} ·{" "}
                      {c.lastSyncAt ? `sync ${dateFmt.format(c.lastSyncAt)}` : "mai sincronizzato"}
                      {c.lastError ? <span className="text-destructive"> · {c.lastError}</span> : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={syncConnection}>
                      <input type="hidden" name="id" value={c.id} />
                      <Button type="submit" size="sm" variant="secondary">Sincronizza ora</Button>
                    </form>
                    <form action={deleteConnection}>
                      <input type="hidden" name="id" value={c.id} />
                      <Button type="submit" size="sm" variant="destructive">Elimina</Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
