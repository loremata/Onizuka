import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Snapshot "colpo d'occhio" dei servizi digitali/AI (gemello della snapshot retail). */
const SLOTS = [
  { key: "web", label: "Sito web", icon: "🌐", slugs: ["website", "ecommerce"] },
  { key: "seo", label: "SEO", icon: "🔎", slugs: ["seo"] },
  { key: "social", label: "Social & ADV", icon: "📣", slugs: ["social-mgmt", "meta-ads"] },
  { key: "leadgen", label: "Lead gen / Ads", icon: "🎯", slugs: ["google-ads", "landing-page"] },
  { key: "branding", label: "Branding", icon: "🎨", slugs: ["branding"] },
  { key: "ai", label: "AI & Automazioni", icon: "🤖", slugs: ["automations", "ai-consulting"] },
  { key: "hosting", label: "Hosting & manutenzione", icon: "🛠️", slugs: ["hosting", "domain", "maintenance"] },
  { key: "consulting", label: "Consulenza", icon: "💡", slugs: ["consulting", "digital-audit"] },
] as const;

type ServiceItem = { name: string; brand: string | null };

export async function ClientDigitalSnapshotCard({ clientId }: { clientId: string }) {
  const active = await prisma.clientCommercialService.findMany({
    where: { clientId, active: true },
    select: {
      commercialService: {
        select: { slug: true, name: true, ecosystemBrand: { select: { name: true } } },
      },
    },
  });

  const bySlug = new Map<string, ServiceItem>();
  for (const a of active) {
    bySlug.set(a.commercialService.slug, {
      name: a.commercialService.name,
      brand: a.commercialService.ecosystemBrand?.name ?? null,
    });
  }
  const activeCount = active.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Servizi Digitali — colpo d&apos;occhio</CardTitle>
        <CardDescription>
          Web, SEO, social, lead gen, branding, AI — stato per area
          {activeCount > 0 ? (
            <>
              {" "}· <strong>{activeCount} attivi</strong>
            </>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SLOTS.map((slot) => {
            const items = slot.slugs
              .map((s) => bySlug.get(s))
              .filter((x): x is ServiceItem => Boolean(x));
            const has = items.length > 0;
            return (
              <div
                key={slot.key}
                className={`rounded-lg border p-2.5 text-sm ${has ? "border-success/40 bg-success/5" : "border-dashed border-border bg-muted/30"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span>{slot.icon}</span>
                    {slot.label}
                  </span>
                  <span className={`text-xs ${has ? "text-success" : "text-muted-foreground"}`}>
                    {has ? "attivo con te" : "non attivo"}
                  </span>
                </div>
                {items.map((it) => (
                  <div
                    key={it.name}
                    className="mt-1.5 border-t border-success/20 pt-1.5 text-xs first:border-0 first:pt-0"
                  >
                    <span className="font-medium text-foreground">{it.name}</span>
                    {it.brand ? <span className="text-muted-foreground"> · {it.brand}</span> : null}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
