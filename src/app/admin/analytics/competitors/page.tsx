import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { runWithDb } from "@/lib/with-db";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { SocialHubTabs } from "@/components/onizuka/social-hub-tabs";
import { Sparkline } from "@/components/onizuka/sparkline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { sourceLabel } from "@/lib/analytics-dashboard";
import { CompetitorForm } from "./competitor-form";
import { deleteCompetitor, recordCompetitorSnapshot } from "./actions";

type Props = { searchParams: Record<string, string | string[] | undefined> };

export default async function CompetitorsPage({ searchParams }: Props) {
  await requireAdminArea();
  const clientId = typeof searchParams.clientId === "string" ? searchParams.clientId : "";

  const loaded = await runWithDb(() =>
    Promise.all([
      prisma.client.findMany({
        orderBy: [{ isOwnBrand: "desc" }, { companyName: "asc" }],
        select: { id: true, companyName: true, isOwnBrand: true },
      }),
      clientId
        ? prisma.competitor.findMany({
            where: { clientId },
            orderBy: { createdAt: "asc" },
            include: { snapshots: { orderBy: { date: "asc" } } },
          })
        : Promise.resolve([]),
    ])
  );

  if (!loaded.ok) {
    return (
      <div className="space-y-6">
        <SocialHubTabs />
        <h1 className="onizuka-page-title">Competitor</h1>
        <DbUnavailableBanner />
      </div>
    );
  }

  const [clients, competitors] = loaded.data;

  return (
    <div className="space-y-6">
      <SocialHubTabs />
      <div>
        <h1 className="onizuka-page-title">Competitor</h1>
        <p className="text-muted-foreground">
          Le API ufficiali non permettono di leggere gli account dei concorrenti. Qui li monitori <strong>a mano</strong>:
          annoti i loro follower quando vuoi e confronti la crescita col cliente. Onesto e conforme.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cliente / brand</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-2">
            <Select
              name="clientId"
              defaultValue={clientId}
              className="flex h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Seleziona…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                  {c.isOwnBrand ? " ⭐" : ""}
                </option>
              ))}
            </Select>
            <Button type="submit" size="sm" variant="secondary">Apri</Button>
          </form>
        </CardContent>
      </Card>

      {!clientId ? (
        <p className="text-sm text-muted-foreground">Seleziona un cliente per gestire i competitor.</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Aggiungi competitor</CardTitle>
            </CardHeader>
            <CardContent>
              <CompetitorForm clientId={clientId} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Competitor monitorati ({competitors.length})</CardTitle>
              <CardDescription>Aggiorna il numero di follower quando lo controlli: costruirai la curva di crescita.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {competitors.length === 0 ? (
                <p className="text-muted-foreground">Nessun competitor. Aggiungine uno sopra.</p>
              ) : (
                competitors.map((cmp) => {
                  const latest = cmp.snapshots.at(-1);
                  const first = cmp.snapshots[0];
                  const delta = latest && first ? latest.followers - first.followers : null;
                  return (
                    <div key={cmp.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {cmp.name}{" "}
                            <span className="text-muted-foreground">· {sourceLabel[cmp.platform]}{cmp.handle ? ` · ${cmp.handle}` : ""}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {latest ? `${latest.followers.toLocaleString("it-IT")} follower` : "nessun dato"}
                            {delta !== null ? ` · ${delta >= 0 ? "+" : ""}${delta.toLocaleString("it-IT")} da inizio` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <form action={recordCompetitorSnapshot} className="flex items-center gap-1">
                            <input type="hidden" name="competitorId" value={cmp.id} />
                            <Input name="followers" type="number" min={0} placeholder="follower oggi" className="h-9 w-36" required />
                            <Button type="submit" size="sm" variant="secondary">Salva</Button>
                          </form>
                          <form action={deleteCompetitor}>
                            <input type="hidden" name="id" value={cmp.id} />
                            <Button type="submit" size="sm" variant="destructive">Elimina</Button>
                          </form>
                        </div>
                      </div>
                      {cmp.snapshots.length > 1 && (
                        <div className="mt-2 text-primary">
                          <Sparkline values={cmp.snapshots.map((s) => s.followers)} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
