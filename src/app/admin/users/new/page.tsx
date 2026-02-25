import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserForm } from "../user-form";

export default async function NewUserPage() {
  const clients = await prisma.client.findMany({
    orderBy: { companyName: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/users">← Users</Link>
        </Button>
      </div>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>New user</CardTitle>
          <CardDescription>Create an admin or client user. Client users must be assigned to a client.</CardDescription>
        </CardHeader>
        <CardContent>
          <UserForm clients={clients} />
        </CardContent>
      </Card>
    </div>
  );
}
