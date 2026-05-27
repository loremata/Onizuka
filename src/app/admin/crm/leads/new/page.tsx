import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadForm } from "../lead-form";

export default async function NewLeadPage() {
  const session = await requireAdminArea();

  const [clients, referrers] = await Promise.all([
    prisma.client.findMany({
      orderBy: { companyName: "asc" },
      select: { id: true, companyName: true },
    }),
    prisma.referrer.findMany({
      where: { ownerUserId: session.user.id, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/crm/leads">← Lead</Link>
        </Button>
      </div>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Nuovo lead</CardTitle>
          <CardDescription>Contatto commerciale non ancora anagraficato come cliente.</CardDescription>
        </CardHeader>
        <CardContent>
          <LeadForm clients={clients} referrers={referrers} />
        </CardContent>
      </Card>
    </div>
  );
}
