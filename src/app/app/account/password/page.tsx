import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { changeOwnPassword } from "@/lib/account-password";
import { ChangePasswordForm } from "@/components/onizuka/change-password-form";
import { prisma } from "@/lib/prisma";

export default async function ClientChangePasswordPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "CLIENT") redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mustChangePassword: true },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cambia password</h1>
        <p className="text-muted-foreground">Portale cliente · {session.user.email}</p>
      </div>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Nuova password</CardTitle>
          <CardDescription>Minimo 8 caratteri.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm action={changeOwnPassword} required={user?.mustChangePassword} />
        </CardContent>
      </Card>
    </div>
  );
}
