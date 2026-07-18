import Link from "next/link";
import { requireFullAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/onizuka/admin-page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OfferRow } from "./offer-row";

export default async function ListinoPage({ searchParams }: { searchParams: { brand?: string } }) {
  const session = await requireFullAdmin();
  const brand = (searchParams.brand ?? "TIM").toUpperCase();

  const offers = await prisma.storeOffer.findMany({
    where: { ownerUserId: session.user.id, brand: brand as never },
    orderBy: [{ lineKey: "asc" }, { feeEur: "asc" }],
  });

  const brands = await prisma.storeOffer.groupBy({ by: ["brand"], _count: { _all: true } });

  // il dato che conta di più: quante offerte mobile cadono sotto il bill size
  const mobile = offers.filter((o) => o.lineKey === "MNP" || o.lineKey === "AL_PP");
  const sotto8 = mobile.filter((o) => Number(o.feeEur) < 8).length;
  const tra8e9 = mobile.filter((o) => Number(o.feeEur) >= 8 && Number(o.feeEur) < 9).length;
  const sopra9 = mobile.filter((o) => Number(o.feeEur) >= 9).length;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Listino offerte"
        lead="La sorgente del canone al banco: scegli l'offerta e il canone si compila da solo."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/inserimenti">← Cruscotto</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {brands.map((b) => (
          <Button key={b.brand} asChild variant={b.brand === brand ? "default" : "outline"} size="sm">
            <Link href={`/admin/inserimenti/listino?brand=${b.brand}`}>
              {b.brand} ({b._count._all})
            </Link>
          </Button>
        ))}
      </div>

      {mobile.length ? (
        <Card className="border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Il bill size è un interruttore, non una scala</CardTitle>
            <CardDescription>
              Sulle offerte mobile: sotto 8 € il gettone di gara <strong>non si prende</strong> (il pezzo conta solo
              per la soglia); da 9 € in su si prende pieno.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-6 text-sm">
            <span>
              <strong className="text-lg tabular-nums">{sotto8}</strong> sotto 8 € — nessun gettone
            </span>
            <span>
              <strong className="text-lg tabular-nums">{tra8e9}</strong> tra 8 e 8,99 € — gettone al 50%
            </span>
            <span>
              <strong className="text-lg tabular-nums">{sopra9}</strong> da 9 € — gettone pieno
            </span>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{offers.length} offerte</CardTitle>
          <CardDescription>
            Il canone è modificabile: viene usato come default alla registrazione, mai per ricalcolare le vendite già
            fatte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {offers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nessuna offerta per {brand}. Importa il listino con{" "}
              <code className="text-xs">npx tsx scripts/import-listino-tim.ts</code>.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Offerta</th>
                    <th className="py-2 pr-4">Codice</th>
                    <th className="py-2 pr-4">Pista</th>
                    <th className="py-2 pr-4 text-right">Canone</th>
                    <th className="py-2 pr-4 text-right">Attiva</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((o) => (
                    <OfferRow
                      key={o.id}
                      offer={{
                        id: o.id,
                        name: o.name,
                        code: o.code,
                        lineKey: o.lineKey,
                        category: o.category,
                        feeEur: Number(o.feeEur),
                        active: o.active,
                      }}
                    />
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

export const dynamic = "force-dynamic";
