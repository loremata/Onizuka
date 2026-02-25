import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientForm } from "../client-form";

export default function NewClientPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/clients">← Clients</Link>
        </Button>
      </div>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>New client</CardTitle>
          <CardDescription>Create a client workspace. Slug is used in URLs and n8n; leave blank to generate from company name.</CardDescription>
        </CardHeader>
        <CardContent>
          <ClientForm />
        </CardContent>
      </Card>
    </div>
  );
}
