import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReferrerForm } from "../referrer-form";

export default async function NewReferrerPage() {
  await requireAdminArea();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/crm/referrers">← Segnalatori</Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Nuovo segnalatore</CardTitle>
        </CardHeader>
        <CardContent>
          <ReferrerForm />
        </CardContent>
      </Card>
    </div>
  );
}
