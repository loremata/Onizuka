import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QuickLeadForm } from "../quick-lead-form";

export default async function QuickLeadPage() {
  const session = await requireAdminArea();

  const referrers = await prisma.referrer.findMany({
    where: { ownerUserId: session.user.id, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/crm/leads">← Lead</Link>
        </Button>
      </div>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Lead banco</CardTitle>
          <CardDescription>
            Cattura rapida in reception: pochi campi, titolo automatico, origine «banco».
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QuickLeadForm referrers={referrers} />
        </CardContent>
      </Card>
    </div>
  );
}
