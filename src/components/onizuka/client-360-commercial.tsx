import Link from "next/link";
import type { ReactNode } from "react";
import type { Client360Profile } from "@/lib/client-360-profile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function ProfileList({
  rows,
  empty,
}: {
  rows: { id: string; title: string; subtitle?: string; href: string; meta?: string }[];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-border/60 text-sm">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
          <div>
            <Link href={r.href} className="font-medium text-primary hover:underline">
              {r.title}
            </Link>
            {r.subtitle ? <p className="text-xs text-muted-foreground">{r.subtitle}</p> : null}
          </div>
          {r.meta ? <span className="text-xs text-muted-foreground">{r.meta}</span> : null}
        </li>
      ))}
    </ul>
  );
}

type Props = {
  clientId: string;
  profile: Client360Profile;
  /** Card extra (es. snapshot colpo d'occhio) rese subito sotto "Identità fiscale univoca". */
  snapshots?: ReactNode;
};

/** Pannelli commerciali monetizzazione sulla scheda cliente 360°. */
export function Client360CommercialPanels({ clientId, profile, snapshots }: Props) {
  const { identity } = profile;

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Identità fiscale univoca</CardTitle>
          <CardDescription>
            Una scheda per P.IVA o codice fiscale — prospect e cliente condividono lo stesso record.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Tipo</p>
            <p className="font-medium">{identity.kindLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Macro-categoria</p>
            <p>{identity.macroLabel ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Partita IVA</p>
            <p className="font-mono text-xs">{identity.vatNumber ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Codice fiscale</p>
            <p className="font-mono text-xs">{identity.fiscalCode ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      {snapshots}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Servizi acquistati</CardTitle>
            <CardDescription>Attivi sul catalogo commerciale.</CardDescription>
          </CardHeader>
          <CardContent>
            {profile.purchasedServices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun servizio attivo.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {profile.purchasedServices.map((s, i) => (
                  <li key={`${s.name}-${i}`}>
                    <strong>{s.name}</strong>
                    {s.brand ? <span className="text-muted-foreground"> · {s.brand}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cross-sell / upsell</CardTitle>
            <CardDescription>Servizi da proporre (gap catalogo).</CardDescription>
          </CardHeader>
          <CardContent>
            {profile.upsellGaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">Catalogo coperto o quasi completo.</p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                {profile.upsellGaps.map((g) => (
                  <li key={g.serviceName}>
                    {g.serviceName}
                    {g.brandName ? <span className="text-muted-foreground"> · {g.brandName}</span> : null}
                  </li>
                ))}
              </ul>
            )}
            <Button asChild variant="link" className="mt-2 h-auto px-0 text-xs">
              <Link href="/admin/crm/cross-sell">Query cross-sell</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preventivi proposti</CardTitle>
            <CardDescription>Bozze e inviati.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileList rows={profile.proposedQuotes} empty="Nessun preventivo collegato." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Persone collegate</CardTitle>
            <CardDescription>Entità Persona ↔ questa azienda.</CardDescription>
          </CardHeader>
          <CardContent>
            {profile.personRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nessuna persona. Aggiungi referenti su{" "}
                <Link href={`/admin/clients/${clientId}/contacts`} className="text-primary hover:underline">
                  Referenti
                </Link>
                .
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {profile.personRoles.map((p) => (
                  <li key={p.personId}>
                    <Link href={`/admin/crm/people/${p.personId}`} className="text-primary hover:underline">
                      {p.fullName}
                    </Link>
                    <span className="text-muted-foreground">
                      {p.role ? ` · ${p.role}` : ""}
                      {p.isPrimary ? " · primario" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comunicazioni inviate</CardTitle>
            <CardDescription>Reach · email segnate come inviate.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileList rows={profile.outreachSent} empty="Nessuna email inviata registrata." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comunicazioni da inviare</CardTitle>
            <CardDescription>Bozze e in approvazione.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileList rows={profile.outreachPending} empty="Nessuna bozza in coda." />
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href={`/admin/reach?clientId=${encodeURIComponent(clientId)}`}>Reach filtrato</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scadenze Flow</CardTitle>
            <CardDescription>Task aperti collegati al cliente.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileList rows={profile.flowDue} empty="Nessun task aperto." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pagamenti e finance</CardTitle>
            <CardDescription>Voci collegate in Finance.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileList rows={profile.financeEntries} empty="Nessuna voce finance." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rinnovi in scadenza</CardTitle>
            <CardDescription>Finance MRR e contratti retail.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileList rows={profile.renewals} empty="Nessun rinnovo programmato." />
          </CardContent>
        </Card>

        {profile.sequences.length > 0 ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Sequenze Reach attive</CardTitle>
            </CardHeader>
            <CardContent>
              <ProfileList rows={profile.sequences} empty="" />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
