import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EditAssetForm } from "../../asset-form";
import { AssetDeleteForm } from "../../asset-delete-form";

export default async function EditClientAssetPage({
  params,
}: {
  params: Promise<{ id: string; assetId: string }>;
}) {
  const session = await requireAdminArea();

  const { id: clientId, assetId } = await params;

  const [client, asset] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, companyName: true },
    }),
    prisma.asset.findFirst({
      where: { id: assetId, clientId },
    }),
  ]);

  if (!client || !asset) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/admin/clients/${client.id}`}>← {client.companyName}</Link>
        </Button>
      </div>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Modifica asset</CardTitle>
          <CardDescription>Aggiorna nome, slug, piattaforma e note. Lo slug deve restare univoco per questo cliente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <EditAssetForm clientId={client.id} asset={asset} />
          <AssetDeleteForm assetId={asset.id} />
        </CardContent>
      </Card>
    </div>
  );
}
