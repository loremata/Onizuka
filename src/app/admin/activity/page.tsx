import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { loadActivityRegister } from "@/lib/activity-register";
import { loadRecentActivity } from "@/lib/activity-feed";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = { searchParams: Record<string, string | string[] | undefined> };

const kindLabel: Record<string, string> = {
  post: "Contenuto",
  flow: "Flow",
  opportunity: "Opportunità",
  lead: "Lead",
  comment: "Commento",
};

export default async function ActivityRegisterPage({ searchParams }: Props) {
  const session = await requireAdminArea();
  const sourceRaw = searchParams.source;
  const source =
    sourceRaw === "audit" || sourceRaw === "automation" ? sourceRaw : ("all" as const);

  const [register, recent] = await Promise.all([
    loadActivityRegister(session.user.id, { limit: 150, source }),
    loadRecentActivity(session.user.id, 15),
  ]);

  const dateFmt = dateTimeFormatIt({ dateStyle: "short", timeStyle: "short" });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin">← Command Center</Link>
        </Button>
      </div>
      <div>
        <h1 className="onizuka-page-title">Registro attività</h1>
        <p className="text-muted-foreground">
          Log sicurezza admin e esecuzioni automazione.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {(
          [
            { label: "Tutti", value: "all" },
            { label: "Audit admin", value: "audit" },
            { label: "Automazioni", value: "automation" },
          ] as const
        ).map((c) => (
          <Link
            key={c.value}
            href={c.value === "all" ? "/admin/activity" : `/admin/activity?source=${c.value}`}
            className={`rounded-full px-3 py-1 ${
              source === c.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {c.label}
          </Link>
        ))}
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/audit">Audit completo + export</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eventi</CardTitle>
          <CardDescription>{register.length} voci recenti</CardDescription>
        </CardHeader>
        <CardContent>
          {register.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun evento in questo filtro.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {register.map((r) => (
                <li key={r.id} className="rounded-md border px-3 py-2">
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                    <span>{dateFmt.format(r.at)}</span>
                    <span className="uppercase">{r.source}</span>
                  </div>
                  <p className="font-medium">
                    {r.href ? (
                      <Link href={r.href} className="text-primary hover:underline">
                        {r.action}
                      </Link>
                    ) : (
                      r.action
                    )}
                  </p>
                  <p className="text-muted-foreground">{r.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.actorLabel}
                    {r.entityLabel ? ` · ${r.entityLabel}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {recent.ok && recent.entries.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Attività recente moduli</CardTitle>
            <CardDescription>Post, flow, lead, opportunità aggiornati di recente.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {recent.entries.map((e) => (
                <li key={e.id}>
                  <Link href={e.href} className="text-primary hover:underline">
                    {e.title}
                  </Link>
                  <span className="text-muted-foreground">
                    {" "}
                    · {kindLabel[e.kind] ?? e.kind} · {e.subtitle}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
