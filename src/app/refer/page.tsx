import { dateTimeFormatIt } from "@/lib/datetime-it";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicReferrerLeadForm } from "./public-referrer-form";
import { ReferrerPortalLogin } from "./referrer-portal-login";
import { assertReferrerPortalAccess } from "./referrer-portal-actions";
import { loadReferrerPortalStats } from "@/lib/referrer-portal-stats";
import { maskIban } from "@/lib/mask-iban";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  NEW: "Nuovo",
  COLD: "Freddo",
  CONTACTED: "Contattato",
  QUALIFIED: "Qualificato",
  LOST: "Perso",
  CONVERTED: "Convertito",
};

import { consumeReferrerMagicLink } from "@/lib/referrer-magic-link";
import { ReferrerMagicLinkForm } from "./referrer-magic-link-form";
import { ReferrerPushOptIn } from "./referrer-push-opt-in";
import { ReferrerGoogleLoginButton } from "./referrer-google-login-button";
import { ReferrerMicrosoftLoginButton } from "./referrer-microsoft-login-button";

export default async function PublicReferPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; magic?: string }>;
}) {
  const { t, magic } = await searchParams;
  const token = typeof t === "string" && t.length >= 16 ? t : null;

  if (token && typeof magic === "string" && magic.length >= 16) {
    await consumeReferrerMagicLink({ submissionToken: token, magicToken: magic });
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Portale segnalazioni</CardTitle>
            <CardDescription>
              Questa pagina è riservata ai link personalizzati inviati dall&apos;agenzia. Se hai ricevuto un URL con
              parametro <code className="text-xs">t=</code>, aprilo per inviare una segnalazione commerciale.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const referrer = await prisma.referrer.findFirst({
    where: { submissionToken: token, active: true },
    select: {
      id: true,
      name: true,
      commissionNotes: true,
      commissionPercent: true,
      portalPinHash: true,
      payoutIban: true,
      ownerUserId: true,
    },
  });

  if (!referrer) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Link non valido</CardTitle>
            <CardDescription>Il token non corrisponde a un segnalatore attivo.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const portalAccess = await assertReferrerPortalAccess(token);
  const needsLogin = !!referrer.portalPinHash && !portalAccess;

  const commissionPct =
    referrer.commissionPercent != null ? Number(referrer.commissionPercent.toString()) : null;

  const [leads, portalStats, payouts] = await Promise.all([
    prisma.lead.findMany({
      where: { referrerId: referrer.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        businessName: true,
      },
    }),
    portalAccess
      ? loadReferrerPortalStats(referrer.id, referrer.ownerUserId, commissionPct)
      : Promise.resolve({
          statusRows: [] as { status: string; count: number }[],
          wonOpportunitySumEur: 0,
          estimateEur: null,
          convertedLeadCount: 0,
        }),
    portalAccess
      ? prisma.referrerPayout.findMany({
          where: { referrerId: referrer.id },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            amountEur: true,
            status: true,
            periodLabel: true,
            paidAt: true,
            notes: true,
            paymentReference: true,
            documentUrl: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const fmt = dateTimeFormatIt({ dateStyle: "short", timeStyle: "short" });
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY?.trim() ?? null;

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-16">
      {needsLogin ? (
        <Card>
          <CardHeader>
            <CardTitle>Accesso portale · {referrer.name}</CardTitle>
            <CardDescription>Inserisci il PIN fornito dall&apos;agenzia per vedere statistiche e liquidazioni.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ReferrerPortalLogin token={token} />
            <ReferrerGoogleLoginButton token={token} />
            <ReferrerMicrosoftLoginButton token={token} />
            <ReferrerMagicLinkForm token={token} />
          </CardContent>
        </Card>
      ) : null}

      {!needsLogin ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Segnalazione per {referrer.name}</CardTitle>
              <CardDescription>
                Compila il modulo: arriverà come lead nel CRM dell&apos;agenzia, attribuito al segnalatore.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PublicReferrerLeadForm token={token} referrerName={referrer.name} />
            </CardContent>
          </Card>

          {portalAccess ? (
            <Card>
              <CardHeader>
                <CardTitle>Riepilogo</CardTitle>
                <CardDescription>Dashboard segnalatore (accesso con PIN).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {portalStats.statusRows.length === 0 ? (
                  <p className="text-muted-foreground">Nessun lead ancora associato.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {portalStats.statusRows.map((r) => (
                      <li key={r.status} className="rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs">
                        <strong>{statusLabel[r.status] ?? r.status}</strong>: {r.count}
                      </li>
                    ))}
                  </ul>
                )}
                {commissionPct != null && commissionPct > 0 ? (
                  <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs">
                    <p className="font-medium text-foreground">Stima provvigione ({commissionPct}%)</p>
                    <p className="mt-1 text-muted-foreground">
                      Base opportunità WON su clienti convertiti:{" "}
                      <strong>
                        {portalStats.wonOpportunitySumEur.toLocaleString("it-IT", { maximumFractionDigits: 0 })} €
                      </strong>
                      <br />
                      Indicativa:{" "}
                      <strong>
                        {portalStats.estimateEur != null
                          ? `${portalStats.estimateEur.toLocaleString("it-IT", { maximumFractionDigits: 2 })} €`
                          : "—"}
                      </strong>
                    </p>
                  </div>
                ) : null}
                {referrer.payoutIban ? (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">IBAN liquidazioni: </span>
                    <code>{maskIban(referrer.payoutIban)}</code>
                  </p>
                ) : null}
                {referrer.commissionNotes ? (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Note: </span>
                    {referrer.commissionNotes}
                  </p>
                ) : null}
                <ReferrerPushOptIn vapidPublicKey={vapidPublicKey} />
              </CardContent>
            </Card>
          ) : null}

          {portalAccess && payouts.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Liquidazioni</CardTitle>
                <CardDescription>Storico provvigioni registrate dall&apos;agenzia.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                <ul className="divide-y">
                  {payouts.map((p) => (
                    <li key={p.id} className="py-2">
                      <p className="font-medium">
                        {Number(p.amountEur.toString()).toLocaleString("it-IT", { maximumFractionDigits: 2 })} € ·{" "}
                        {p.status === "PAID" ? "Pagato" : "In attesa"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fmt.format(p.createdAt)}
                        {p.periodLabel ? ` · ${p.periodLabel}` : ""}
                        {p.paidAt ? ` · pagato ${fmt.format(p.paidAt)}` : ""}
                        {p.notes ? ` · ${p.notes}` : ""}
                        {p.paymentReference ? ` · rif. ${p.paymentReference}` : ""}
                      </p>
                      {p.status === "PAID" && p.documentUrl ? (
                        <a
                          href={p.documentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          Scarica documento liquidazione
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : portalAccess ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                Nessuna liquidazione registrata dall&apos;agenzia.
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Le tue ultime segnalazioni</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {leads.length === 0 ? (
                <p className="text-muted-foreground">Nessuna segnalazione inviata finora.</p>
              ) : (
                <ul className="divide-y">
                  {leads.map((row) => (
                    <li key={row.id} className="py-2">
                      <p className="font-medium">{row.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmt.format(row.createdAt)} · {statusLabel[row.status] ?? row.status}
                        {row.businessName ? ` · ${row.businessName}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
