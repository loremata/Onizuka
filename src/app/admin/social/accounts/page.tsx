import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { runWithDb } from "@/lib/with-db";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { SocialHubTabs } from "@/components/onizuka/social-hub-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { platformLabelIt } from "@/lib/post-ui-labels";
import type { SocialAccountStatus } from "@prisma/client";
import { SocialAccountForm } from "./social-account-form";
import { deleteSocialAccount, revokeSocialAccount, snapshotSocialAccount } from "./actions";

const statusLabel: Record<SocialAccountStatus, string> = {
  CONNECTED: "Collegato",
  EXPIRED: "Token scaduto",
  REVOKED: "Revocato",
};

export default async function SocialAccountsPage() {
  await requireAdminArea();

  const loaded = await runWithDb(() =>
    Promise.all([
      prisma.socialAccount.findMany({
        orderBy: [{ client: { companyName: "asc" } }, { platform: "asc" }],
        include: { client: { select: { companyName: true, slug: true } } },
      }),
      prisma.client.findMany({
        orderBy: [{ isOwnBrand: "desc" }, { companyName: "asc" }],
        select: { id: true, companyName: true, slug: true, isOwnBrand: true },
      }),
    ])
  );

  if (!loaded.ok) {
    return (
      <div className="space-y-6">
        <SocialHubTabs />
        <div>
          <h1 className="onizuka-page-title">Account social collegati</h1>
          <p className="text-muted-foreground">Connessioni per pubblicare per conto dei clienti.</p>
        </div>
        <DbUnavailableBanner />
      </div>
    );
  }

  const [accounts, clients] = loaded.data;

  return (
    <div className="space-y-6">
      <SocialHubTabs />
      <div>
        <h1 className="onizuka-page-title">Account social collegati</h1>
        <p className="text-muted-foreground">
          Ogni account salva un token cifrato: il Publisher pubblica i post programmati usando il token del
          suo account (multi-cliente). Modalità MANAGED: sei tu admin del Business Manager.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Collega un account (MANAGED)</CardTitle>
          <CardDescription>
            Per i tuoi asset (⭐ brand proprio) o per i clienti di cui gestisci il Business Manager.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SocialAccountForm clients={clients} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account collegati ({accounts.length})</CardTitle>
          <CardDescription>Revoca stacca il token e tiene lo storico; elimina rimuove del tutto.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {accounts.length === 0 ? (
            <p className="text-muted-foreground">Nessun account collegato. Aggiungine uno dal form sopra.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {accounts.map((a) => (
                <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {a.displayName}{" "}
                      <span className="text-muted-foreground">· {platformLabelIt[a.platform]}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.client.companyName} · ID {a.externalAccountId} ·{" "}
                      <span className={a.status === "CONNECTED" ? "text-primary" : "text-destructive"}>
                        {statusLabel[a.status]}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.status === "CONNECTED" && (
                      <form action={snapshotSocialAccount}>
                        <input type="hidden" name="id" value={a.id} />
                        <Button type="submit" variant="secondary" size="sm">
                          Aggiorna statistiche
                        </Button>
                      </form>
                    )}
                    {a.status === "CONNECTED" && (
                      <form action={revokeSocialAccount}>
                        <input type="hidden" name="id" value={a.id} />
                        <Button type="submit" variant="outline" size="sm">
                          Revoca
                        </Button>
                      </form>
                    )}
                    <form action={deleteSocialAccount}>
                      <input type="hidden" name="id" value={a.id} />
                      <Button type="submit" variant="destructive" size="sm">
                        Elimina
                      </Button>
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
