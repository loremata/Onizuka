import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { ensureCommercialCatalogSeeded } from "@/lib/commercial-catalog-seed";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function EcosystemBrandsPage() {
  const session = await requireAdminArea();

  await ensureCommercialCatalogSeeded();

  const brands = await prisma.ecosystemBrand.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { commercialServices: true } },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/sales">← Sales</Link>
        </Button>
        <h1 className="mt-2 onizuka-page-title">Brand ecosistema</h1>
        <p className="text-muted-foreground">
          Memoria commerciale strutturata: LabSeven, StudioPop, DoctorLead e altri asset Lorenzo.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {brands.map((b) => (
          <Card key={b.id}>
            <CardHeader>
              <CardTitle>{b.name}</CardTitle>
              <CardDescription>
                {b.domain ?? b.slug} · {b._count.commercialServices} servizi collegati
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {b.mission ? <p>{b.mission}</p> : null}
              {b.positioning ? <p className="italic">{b.positioning}</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
