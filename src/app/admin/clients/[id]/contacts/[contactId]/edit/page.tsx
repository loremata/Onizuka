import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EditContactForm } from "./edit-contact-form";

export default async function EditClientContactPage({
  params,
}: {
  params: Promise<{ id: string; contactId: string }>;
}) {
  const session = await requireAdminArea();

  const { id: clientId, contactId } = await params;
  const contact = await prisma.clientContact.findFirst({
    where: { id: contactId, clientId },
  });
  if (!contact) notFound();

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { companyName: true },
  });
  if (!client) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/admin/clients/${clientId}/contacts`}>← Referenti</Link>
        </Button>
      </div>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Modifica referente</CardTitle>
          <CardDescription>{client.companyName}</CardDescription>
        </CardHeader>
        <CardContent>
          <EditContactForm contact={contact} clientId={clientId} />
        </CardContent>
      </Card>
    </div>
  );
}
