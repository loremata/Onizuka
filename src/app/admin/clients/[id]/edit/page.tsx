import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DriveCreateFolderButton } from "@/components/onizuka/drive-create-folder-button";
import { isGoogleDriveServiceAccountConfigured } from "@/lib/google-drive-service";
import { ClientForm } from "../../client-form";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/clients">← Clienti</Link>
        </Button>
      </div>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Modifica cliente</CardTitle>
          <CardDescription>Aggiorna anagrafica, stato pipeline CRM e note operative.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DriveCreateFolderButton
            clientId={client.id}
            hasFolder={Boolean(client.driveFolderUrl?.trim())}
            driveConfigured={isGoogleDriveServiceAccountConfigured()}
          />
          <ClientForm client={client} />
        </CardContent>
      </Card>
    </div>
  );
}
