import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
          <Link href="/admin/clients">← Clients</Link>
        </Button>
      </div>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Edit client</CardTitle>
          <CardDescription>Update company name, slug, or contact email.</CardDescription>
        </CardHeader>
        <CardContent>
          <ClientForm client={client} />
        </CardContent>
      </Card>
    </div>
  );
}
