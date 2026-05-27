import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { loadDriveOverview } from "@/lib/drive-stats";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function AdminDrivePage() {
  const session = await requireAdminArea();

  const result = await loadDriveOverview();

  if (!result.ok) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Onizuka Drive</h1>
          <p className="text-muted-foreground">Hub documenti per cliente (MVP).</p>
        </div>
        <DbUnavailableBanner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Onizuka Drive</h1>
        <p className="text-muted-foreground">
          Hub per cliente: contenuti Onizuka + cartella Google Drive (URL manuale o creazione automatica con service
          account).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Spazi per cliente</CardTitle>
          <CardDescription>Apri la cartella per vedere i contenuti collegati.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Cliente</th>
                <th className="pb-2 pr-4 font-medium">Post</th>
                <th className="pb-2 pr-4 font-medium">Asset</th>
                <th className="pb-2 pr-4 font-medium">Memoria</th>
                <th className="pb-2 pr-4 font-medium">Ticket</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {result.clients.map((c) => (
                <tr key={c.id} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-4">
                    <Link className="font-medium text-primary hover:underline" href={`/admin/clients/${c.id}`}>
                      {c.companyName}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">{c.slug}</p>
                  </td>
                  <td className="py-2 pr-4">{c.postCount}</td>
                  <td className="py-2 pr-4">{c.assetCount}</td>
                  <td className="py-2 pr-4">{c.memoryCount}</td>
                  <td className="py-2 pr-4">{c.ticketCount}</td>
                  <td className="py-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/drive/${c.id}`}>Apri cartella</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
