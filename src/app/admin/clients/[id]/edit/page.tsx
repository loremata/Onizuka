import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DriveCreateFolderButton } from "@/components/onizuka/drive-create-folder-button";
import { isGoogleDriveServiceAccountConfigured } from "@/lib/google-drive-service";
import { ClientForm } from "../../client-form";
import { ClientDeleteButton } from "../../client-delete-button";
import { getClientMergeImpact } from "@/lib/client-merge-impact";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) notFound();

  const impact = await getClientMergeImpact(client.id);

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

      <Card className="max-w-3xl border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base">Zona pericolosa</CardTitle>
          <CardDescription>
            L&apos;eliminazione cancella a cascata contratti, opportunità (anche quelle vinte),
            ticket, contatti e asset di questo cliente. Se stai ripulendo dei doppioni usa
            invece <Link href="/admin/crm/dedupe" className="underline">Unisci duplicati</Link>,
            che conserva lo storico.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClientDeleteButton
            clientId={client.id}
            companyName={client.companyName}
            impact={impact}
          />
        </CardContent>
      </Card>
    </div>
  );
}
