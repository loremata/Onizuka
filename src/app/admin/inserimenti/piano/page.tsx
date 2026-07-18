import Link from "next/link";
import { requireFullAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/onizuka/admin-page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { currentMonth, shiftMonth } from "@/lib/inserimenti/dashboard";
import { DuplicaPiani } from "./duplica-piani";

export default async function PianoPage({ searchParams }: { searchParams: { mese?: string } }) {
  const session = await requireFullAdmin();
  const month = /^\d{4}-\d{2}$/.test(searchParams.mese ?? "") ? searchParams.mese! : currentMonth();
  const prevMonth = shiftMonth(month, -1);

  const plans = await prisma.incentivePlan.findMany({
    where: { ownerUserId: session.user.id, month },
    include: { lines: { include: { tiers: true } }, prizes: { include: { gates: true } } },
    orderBy: { brand: "asc" },
  });

  const prevCount = await prisma.incentivePlan.count({
    where: { ownerUserId: session.user.id, month: prevMonth },
  });

  const monthLabel = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Piani provvigionali"
        lead="I numeri delle gare cambiano ogni mese. Qui si aggiornano senza toccare il codice."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/inserimenti">← Cruscotto</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/inserimenti/piano?mese=${prevMonth}`}>← {prevMonth}</Link>
        </Button>
        <span className="font-semibold capitalize">{monthLabel}</span>
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/inserimenti/piano?mese=${shiftMonth(month, 1)}`}>{shiftMonth(month, 1)} →</Link>
        </Button>
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nessun piano per {month}</CardTitle>
            <CardDescription>
              {prevCount > 0 ? (
                <>
                  Ci sono {prevCount} piani su {prevMonth}: duplicali qui e correggi i numeri quando arriva la lettera
                  di gara. È la procedura normale, visto che la lettera arriva sempre a mese già iniziato.
                </>
              ) : (
                <>Nessun piano nemmeno su {prevMonth}: va creato col seed.</>
              )}
            </CardDescription>
          </CardHeader>
          {prevCount > 0 ? (
            <CardContent>
              <DuplicaPiani fromMonth={prevMonth} toMonth={month} />
            </CardContent>
          ) : null}
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {plans.map((p) => (
              <Card key={p.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{p.brand}</CardTitle>
                      <CardDescription>{p.label}</CardDescription>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    {p.lines.length} piste · {p.lines.reduce((s, l) => s + l.tiers.length, 0)} scaglioni
                    {p.prizes.length ? ` · ${p.prizes.length} premi` : ""}
                    {p.prizes.reduce((s, pr) => s + pr.gates.length, 0)
                      ? ` · ${p.prizes.reduce((s, pr) => s + pr.gates.length, 0)} cancelli`
                      : ""}
                  </div>
                  {p.notes ? <p className="text-xs text-muted-foreground">{p.notes}</p> : null}
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/inserimenti/piano/${p.id}`}>Apri e modifica</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {prevCount > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Prepara il mese successivo</CardTitle>
                <CardDescription>
                  Duplica i piani di {month} su {shiftMonth(month, 1)} in stato provvisorio.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DuplicaPiani fromMonth={month} toMonth={shiftMonth(month, 1)} />
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    PROVISIONAL: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    ARCHIVED: "bg-muted text-muted-foreground",
  };
  const label: Record<string, string> = {
    ACTIVE: "confermato",
    PROVISIONAL: "provvisorio",
    ARCHIVED: "archiviato",
  };
  return (
    <span className={"shrink-0 rounded-full px-2 py-0.5 text-xs font-medium " + (map[status] ?? "")}>
      {label[status] ?? status}
    </span>
  );
}
