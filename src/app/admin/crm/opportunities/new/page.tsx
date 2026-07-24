import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OpportunityForm } from "../opportunity-form";

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function NewOpportunityPage({ searchParams }: Props) {
  const session = await requireAdminArea();

  const clientIdParam = firstParam(searchParams.clientId);
  const serviceSlug = firstParam(searchParams.service);

  const [clients, assets, service] = await Promise.all([
    prisma.client.findMany({
      orderBy: { companyName: "asc" },
      select: { id: true, companyName: true },
    }),
    prisma.asset.findMany({
      orderBy: [{ clientId: "asc" }, { name: "asc" }],
      select: { id: true, clientId: true, name: true },
    }),
    serviceSlug
      ? prisma.commercialService.findUnique({ where: { slug: serviceSlug }, select: { name: true } })
      : Promise.resolve(null),
  ]);

  const presetClientId = clientIdParam && clients.some((c) => c.id === clientIdParam) ? clientIdParam : undefined;
  const presetTitle = service?.name ?? undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/crm/opportunities">← Opportunità</Link>
        </Button>
      </div>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Nuova opportunità</CardTitle>
          <CardDescription>Collega una trattativa a un cliente CRM esistente.</CardDescription>
        </CardHeader>
        <CardContent>
          <OpportunityForm
            clients={clients}
            assets={assets}
            presetClientId={presetClientId}
            presetTitle={presetTitle}
          />
        </CardContent>
      </Card>
    </div>
  );
}
