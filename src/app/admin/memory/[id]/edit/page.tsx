import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MemoryItemForm } from "../../memory-item-form";
import { MemoryDeleteForm } from "../../memory-delete-form";

export default async function EditMemoryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminArea();

  const { id } = await params;
  const memory = await prisma.memoryItem.findFirst({
    where: { id, ownerUserId: session.user.id },
  });
  if (!memory) notFound();

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
          <Link href="/admin/memory">← Memoria</Link>
        </Button>
      </div>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Modifica memoria</CardTitle>
          <CardDescription>Aggiorna titolo, contenuto, ambito e collegamenti.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <MemoryItemForm clients={clients} assets={assets} memory={memory} />
          <MemoryDeleteForm memoryId={memory.id} />
        </CardContent>
      </Card>
    </div>
  );
}
