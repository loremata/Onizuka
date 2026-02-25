import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true },
  });
  if (!user) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/users">← Users</Link>
        </Button>
      </div>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
          <CardDescription>
            Set a new password for {user.email}
            {user.name ? ` (${user.name})` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm userId={user.id} />
        </CardContent>
      </Card>
    </div>
  );
}
