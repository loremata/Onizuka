import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OpportunityForm } from "../opportunity-form";

export default async function NewOpportunityPage() {
  const session = await requireAdminArea();

  const clients = await prisma.client.findMany({
    orderBy: { companyName: "asc" },
    select: { id: true, companyName: true },
  });

  const assets = await prisma.asset.findMany({
    orderBy: [{ clientId: "asc" }, { name: "asc" }],
    select: { id: true, clientId: true, name: true },
  });

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
          <OpportunityForm clients={clients} assets={assets} />
        </CardContent>
      </Card>
    </div>
  );
}
