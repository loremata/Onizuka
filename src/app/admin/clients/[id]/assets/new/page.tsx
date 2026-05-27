import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewAssetForm } from "../asset-form";

export default async function NewClientAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminArea();

  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true, companyName: true },
  });
  if (!client) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/admin/clients/${client.id}`}>← {client.companyName}</Link>
        </Button>
      </div>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Nuovo asset</CardTitle>
          <CardDescription>
            Canale o presenza digitale collegata al cliente (social, GBP, brand). Sarà selezionabile su opportunità
            e memorie.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewAssetForm clientId={client.id} />
        </CardContent>
      </Card>
    </div>
  );
}
