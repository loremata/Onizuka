import Link from "next/link";
import { requireFullAdmin } from "@/lib/admin-session";
import { AdminPageHeader } from "@/components/onizuka/admin-page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DonutChart } from "@/components/onizuka/donut-chart";
import { currentMonth, shiftMonth } from "@/lib/inserimenti/dashboard";
import { loadBreakdown, type Slice } from "@/lib/inserimenti/breakdown";

const eur = (n: number) => "€ " + n.toLocaleString("it-IT", { maximumFractionDigits: 0 });

export default async function AnalisiPage({
  searchParams,
}: {
  searchParams: { mese?: string; brand?: string; cat?: string };
}) {
  const session = await requireFullAdmin();
  const month = /^\d{4}-\d{2}$/.test(searchParams.mese ?? "") ? searchParams.mese! : currentMonth();
  const brand = searchParams.brand || null;
  const cat = searchParams.cat || null;

  const d = await loadBreakdown(session.user.id, month, brand, cat);

  const monthLabel = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
  });

  /** Costruisce il link mantenendo gli altri filtri. */
  const link = (patch: { brand?: string | null; cat?: string | null; mese?: string }) => {
    const p = new URLSearchParams();
    const m = patch.mese ?? month;
    if (m !== currentMonth()) p.set("mese", m);
    const b = patch.brand === undefined ? brand : patch.brand;
    const c = patch.cat === undefined ? cat : patch.cat;
    if (b) p.set("brand", b);
    if (c) p.set("cat", c);
    const q = p.toString();
    return "/admin/inserimenti/analisi" + (q ? `?${q}` : "");
  };

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Analisi"
        lead="Filtra per brand e categoria, poi apri una categoria per vedere di cosa è fatta."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/inserimenti?mese=${month}`}>← Cruscotto</Link>
          </Button>
        }
      />

      {/* mese */}
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href={link({ mese: shiftMonth(month, -1) })}>←</Link>
        </Button>
        <span className="font-semibold capitalize">{monthLabel}</span>
        <Button asChild variant="outline" size="sm">
          <Link href={link({ mese: shiftMonth(month, 1) })}>→</Link>
        </Button>
      </div>

      {/* filtro brand */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Brand</p>
        <div className="flex flex-wrap gap-2">
          <Chip href={link({ brand: null, cat: null })} active={!brand}>
            Tutti
          </Chip>
          {d.brands.map((b) => (
            <Chip key={b.name} href={link({ brand: b.name, cat: null })} active={brand === b.name}>
              {b.name} <span className="opacity-60">{b.qty}</span>
            </Chip>
          ))}
        </div>
      </div>

      {/* filtro categoria */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Categoria {brand ? `· solo ${brand}` : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <Chip href={link({ cat: null })} active={!cat}>
            Tutte
          </Chip>
          {d.categories.map((c) => (
            <Chip key={c.name} href={link({ cat: c.name })} active={cat === c.name}>
              {c.name} <span className="opacity-60">{c.qty}</span>
            </Chip>
          ))}
        </div>
      </div>

      {/* totale della selezione */}
      <Card>
        <CardHeader className="pb-3">
          <CardDescription>
            {brand || cat ? (
              <>
                Selezione: {brand ?? "tutti i brand"}
                {cat ? ` · ${cat}` : ""}
              </>
            ) : (
              "Tutto il mese"
            )}
          </CardDescription>
          <CardTitle className="text-2xl">
            {d.totale.qty} pezzi · {eur(d.totale.compenso)}
          </CardTitle>
          {d.totale.senzaCanone > 0 ? (
            <p className="pt-1 text-xs text-amber-700 dark:text-amber-300">
              ⚠ {d.totale.senzaCanone} vendite senza canone: il loro compenso non è calcolabile e conta come 0. Il totale
              reale è più alto.
            </p>
          ) : null}
        </CardHeader>
      </Card>

      {/* panoramica quando non c'è una categoria aperta */}
      {!cat ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pezzi per brand</CardTitle>
            </CardHeader>
            <CardContent>
              <DonutChart
                slices={d.brands.map((b) => ({ name: b.name, value: b.qty, hint: eur(b.compenso) }))}
                centerLabel={String(d.brands.reduce((a, b) => a + b.qty, 0))}
                centerSub="pezzi"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pezzi per categoria</CardTitle>
              <CardDescription>Clicca una categoria qui sopra per aprirla.</CardDescription>
            </CardHeader>
            <CardContent>
              <DonutChart
                slices={d.categories.map((c) => ({ name: c.name, value: c.qty, hint: eur(c.compenso) }))}
                centerLabel={String(d.categories.reduce((a, c) => a + c.qty, 0))}
                centerSub="pezzi"
              />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* spaccato della categoria aperta */}
      {d.detail ? (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Spaccato · {d.detail.category}</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href={link({ cat: null })}>Chiudi ✕</Link>
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <DetailCard
              title="Per tipo di operazione"
              description="Le piste che compongono questa categoria."
              slices={d.detail.byLine}
            />
            {d.detail.byPagamento.length > 1 ? (
              <DetailCard
                title="Ricaricabili vs domiciliate"
                description="La domiciliazione cambia il compenso: +1,2 sulle MNP, +1,5 sulle AL, e sul fisso da 1,7 a 5,0."
                slices={d.detail.byPagamento}
              />
            ) : null}
            <DetailCard
              title="Per offerta"
              description="Quali offerte hai venduto davvero."
              slices={d.detail.byOffer}
            />
            {d.detail.byProvenance.length ? (
              <DetailCard
                title="Provenienza (MNP)"
                description="Da quale operatore arrivano le portabilità."
                slices={d.detail.byProvenance}
              />
            ) : null}
            {d.detail.byBrand.length > 1 ? (
              <DetailCard title="Per brand" description="" slices={d.detail.byBrand} />
            ) : null}
          </div>
        </>
      ) : null}

      {d.totale.qty === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nessuna vendita per questa selezione.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={
        "rounded-full border px-3 py-1.5 text-sm transition-colors " +
        (active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border hover:border-primary hover:bg-muted")
      }
    >
      {children}
    </Link>
  );
}

function DetailCard({ title, description, slices }: { title: string; description: string; slices: Slice[] }) {
  const tot = slices.reduce((a, s) => a + s.compenso, 0);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <DonutChart
          slices={slices.map((s) => ({
            name: s.name,
            value: s.qty,
            hint: s.compenso > 0 ? eur(s.compenso) : "compenso non calcolabile",
          }))}
          centerLabel={String(slices.reduce((a, s) => a + s.qty, 0))}
          centerSub={tot > 0 ? eur(tot) : "pezzi"}
        />
      </CardContent>
    </Card>
  );
}
