import Link from "next/link";
import { requireFullAdmin } from "@/lib/admin-session";
import { loadFinanceByBrand } from "@/lib/finance-by-brand";
import { AdminPageHeader } from "@/components/onizuka/admin-page-header";
import { AnalyticsHubTabs } from "@/components/onizuka/analytics-hub-tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function EconomicsPage() {
  const session = await requireFullAdmin();
  const rows = await loadFinanceByBrand(session.user.id);

  const totalIncome = rows.reduce((s, r) => s + r.incomeEur, 0);
  const totalMargin = rows.reduce((s, r) => s + r.marginEur, 0);

  return (
    <div className="space-y-8">
      <AnalyticsHubTabs />
      <AdminPageHeader
        title="Economics"
        lead="Ricavi, costi e margini per brand ecosistema · mese corrente."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/finance">Finance completo</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Entrate mese</CardDescription>
            <CardTitle className="text-2xl">
              € {totalIncome.toLocaleString("it-IT", { maximumFractionDigits: 0 })}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Margine mese</CardDescription>
            <CardTitle className="text-2xl">
              € {totalMargin.toLocaleString("it-IT", { maximumFractionDigits: 0 })}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Per brand</CardTitle>
          <CardDescription>Allocazione via servizi attivi sul cliente collegato alle voci Finance.</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna voce nel mese corrente.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Brand</th>
                    <th className="pb-2 pr-4">Entrate</th>
                    <th className="pb-2 pr-4">Uscite</th>
                    <th className="pb-2 pr-4">Margine</th>
                    <th className="pb-2">Voci</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.brandSlug} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-medium">{r.brandName}</td>
                      <td className="py-2 pr-4">€ {r.incomeEur.toLocaleString("it-IT")}</td>
                      <td className="py-2 pr-4">€ {r.expenseEur.toLocaleString("it-IT")}</td>
                      <td className="py-2 pr-4">€ {r.marginEur.toLocaleString("it-IT")}</td>
                      <td className="py-2">{r.entryCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
