import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReferrerForm } from "../../referrer-form";
import { ReferrerPortalCard } from "../../referrer-portal-card";
import { ReferrerPortalPinForm } from "../../referrer-portal-pin-form";
import { ReferrerPayoutsPanel } from "../../referrer-payouts-panel";

export default async function EditReferrerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminArea();
  const { id } = await params;

  const referrer = await prisma.referrer.findFirst({
    where: { id, ownerUserId: session.user.id },
    include: {
      payouts: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!referrer) notFound();

  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const publicBaseUrl = `${proto}://${host}`;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/crm/referrers">← Segnalatori</Link>
      </Button>
      <ReferrerPortalCard
        referrerId={referrer.id}
        submissionToken={referrer.submissionToken}
        publicBaseUrl={publicBaseUrl}
      />
      <Card>
        <CardHeader>
          <CardTitle>PIN portale segnalatore</CardTitle>
        </CardHeader>
        <CardContent>
          <ReferrerPortalPinForm referrerId={referrer.id} hasPin={!!referrer.portalPinHash} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Liquidazioni</CardTitle>
        </CardHeader>
        <CardContent>
          <ReferrerPayoutsPanel
            referrerId={referrer.id}
            payouts={referrer.payouts.map((p) => ({
              id: p.id,
              amountEur: p.amountEur.toString(),
              status: p.status,
              periodLabel: p.periodLabel,
              paidAt: p.paidAt,
              notes: p.notes,
              paymentReference: p.paymentReference,
              documentUrl: p.documentUrl,
              createdAt: p.createdAt,
            }))}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Modifica segnalatore</CardTitle>
        </CardHeader>
        <CardContent>
          <ReferrerForm referrer={referrer} />
        </CardContent>
      </Card>
    </div>
  );
}
