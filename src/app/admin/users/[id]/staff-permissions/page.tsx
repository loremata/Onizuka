import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFullAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StaffPermissionsForm } from "./staff-permissions-form";

export default async function StaffPermissionsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFullAdmin();
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      staffAllowedModules: true,
      staffDeniedActions: true,
      canApproveTimeEntries: true,
      timeApproverProjectCodes: true,
      timeApproverClientIds: true,
    },
  });

  if (!user || user.role !== "STAFF") notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/users">← Utenti</Link>
        </Button>
        <h1 className="mt-2 onizuka-page-title">Permessi staff</h1>
        <p className="text-muted-foreground">
          {user.name ?? user.email} — whitelist moduli (vuoto = policy predefinita).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Moduli consentiti</CardTitle>
          <CardDescription>
            Se nessun modulo è selezionato, valgono i divieti predefiniti (no Finanza, Utenti, Go-live,
            Integrazioni).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StaffPermissionsForm
            userId={user.id}
            initialModules={user.staffAllowedModules}
            initialDeniedActions={user.staffDeniedActions}
            canApproveTimeEntries={user.canApproveTimeEntries}
            timeApproverProjectCodes={user.timeApproverProjectCodes}
            timeApproverClientIds={user.timeApproverClientIds}
          />
        </CardContent>
      </Card>
    </div>
  );
}
