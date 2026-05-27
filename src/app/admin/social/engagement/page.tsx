import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { loadSocialEngagementReport } from "@/lib/social-engagement-report";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SocialEngagementPage() {
  await requireAdminArea();
  const report = await loadSocialEngagementReport();

  const byPlatform = new Map<string, number>();
  for (const r of report.rows) {
    byPlatform.set(r.platformLabel, (byPlatform.get(r.platformLabel) ?? 0) + r.count);
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/social">← Social Pro</Link>
        </Button>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Report engagement</h1>
        <p className="text-muted-foreground">
          Aggregato da post in Contenuti — {report.totalPosts} post totali, {report.scheduledNext7d} programmati nei
          prossimi 7 giorni.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Post totali</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{report.totalPosts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Programmati 7gg</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{report.scheduledNext7d}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Piattaforme</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{byPlatform.size}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dettaglio per piattaforma e stato</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2">Piattaforma</th>
                <th className="py-2">Stato</th>
                <th className="py-2 text-right">N.</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r, i) => (
                <tr key={i} className="border-b border-border/40">
                  <td className="py-2">{r.platformLabel}</td>
                  <td className="py-2">{r.status}</td>
                  <td className="py-2 text-right font-medium">{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
