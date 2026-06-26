import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { CrmDirectoryTabs } from "@/components/onizuka/crm-directory-tabs";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseClientListFilters, buildClientSearchWhere } from "@/lib/client-list-filters";
import { ClientTagsAttributes } from "@/components/onizuka/client-tags-attributes";

const kindLabel: Record<string, string> = { PRIVATE: "Privato", BUSINESS: "Azienda" };
const macroLabel: Record<string, string> = {
  RETAIL_STORE: "Retail",
  DIGITAL_AI: "Digital/AI",
  MIXED: "Misto",
};

type Props = { searchParams: Record<string, string | string[] | undefined> };

export default async function ClientDatabasePage({ searchParams }: Props) {
  await requireAdminArea();
  const filters = parseClientListFilters(searchParams);

  const clients = await prisma.client.findMany({
    where: buildClientSearchWhere(filters),
    orderBy: { companyName: "asc" },
    take: 300,
    select: {
      id: true,
      companyName: true,
      kind: true,
      status: true,
      city: true,
      website: true,
      tags: true,
      attributes: { select: { key: true, value: true } },
      commercialServices: {
        where: { active: true },
        select: { commercialService: { select: { name: true } } },
      },
      retailContracts: {
        where: { status: "ACTIVE" },
        select: { monthlyEur: true },
      },
    },
  });

  const fmtEur = (n: number) =>
    n.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      <CrmDirectoryTabs />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/clients">← Clienti</Link>
          </Button>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Database clienti</h1>
          <p className="text-muted-foreground">
            Vista unica privati + aziende con tag e attributi liberi. Filtra per costruire segmenti.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtri</CardTitle>
          <CardDescription>Testo, tipo, macro-categoria, tag e attributo (chiave/valore).</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <input name="q" defaultValue={filters.q} placeholder="Nome, email, città…" className="flex h-10 w-full max-w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <select name="kind" defaultValue={filters.kind} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Tipo: tutti</option>
              <option value="PRIVATE">Privato</option>
              <option value="BUSINESS">Azienda</option>
            </select>
            <select name="macro" defaultValue={filters.macro} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Macro: tutte</option>
              <option value="RETAIL_STORE">Retail</option>
              <option value="DIGITAL_AI">Digital/AI</option>
              <option value="MIXED">Misto</option>
            </select>
            <Input name="tag" defaultValue={filters.tag} placeholder="Tag (es. TIM)" className="max-w-[140px]" />
            <Input name="attrKey" defaultValue={filters.attrKey} placeholder="Attr. chiave" className="max-w-[130px]" />
            <Input name="attrValue" defaultValue={filters.attrValue} placeholder="Attr. valore" className="max-w-[130px]" />
            <div className="flex gap-2">
              <Button type="submit" size="sm">Applica</Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/crm/database">Azzera</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clienti ({clients.length})</CardTitle>
          <CardDescription>Max 300 risultati. Aggiungi tag al volo; attributi completi nella scheda cliente.</CardDescription>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun cliente con questi filtri.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left align-bottom">
                    <th className="pb-2 font-medium">Cliente</th>
                    <th className="pb-2 font-medium">Tipo</th>
                    <th className="pb-2 font-medium">Città</th>
                    <th className="pb-2 font-medium text-right">MRR retail</th>
                    <th className="pb-2 font-medium">Servizi</th>
                    <th className="pb-2 font-medium">Tag</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => {
                    const mrr = c.retailContracts.reduce((s, r) => s + Number(r.monthlyEur.toString()), 0);
                    const services = c.commercialServices.map((s) => s.commercialService.name);
                    return (
                      <tr key={c.id} className="border-b align-top last:border-0">
                        <td className="py-3 pr-3">
                          <Link href={`/admin/clients/${c.id}`} className="font-medium text-primary hover:underline">
                            {c.companyName}
                          </Link>
                          {c.attributes.length > 0 ? (
                            <p className="text-[11px] text-muted-foreground">
                              {c.attributes.slice(0, 4).map((a) => `${a.key}: ${a.value}`).join(" · ")}
                            </p>
                          ) : null}
                        </td>
                        <td className="py-3 pr-3 text-muted-foreground">{c.kind ? kindLabel[c.kind] : "—"}</td>
                        <td className="py-3 pr-3 text-muted-foreground">{c.city ?? "—"}</td>
                        <td className="py-3 pr-3 text-right tabular-nums">{mrr > 0 ? `€ ${fmtEur(mrr)}` : "—"}</td>
                        <td className="py-3 pr-3 text-xs text-muted-foreground">
                          {services.length ? services.slice(0, 3).join(", ") + (services.length > 3 ? "…" : "") : "—"}
                        </td>
                        <td className="py-3 min-w-[240px]">
                          <ClientTagsAttributes clientId={c.id} tags={c.tags} attributes={c.attributes} compact />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
