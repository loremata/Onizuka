import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type LinkItem = {
  href: string;
  label: string;
  description: string;
  badge?: number;
};

type Props = {
  approvalPending: number;
  pendingPosts: number;
};

export function CommandCenterQuickLinks({ approvalPending, pendingPosts }: Props) {
  const links: LinkItem[] = [
    {
      href: "/admin/approvals",
      label: "Coda approvazioni",
      description: "Email, preventivi, post da approvare",
      badge: approvalPending > 0 ? approvalPending : undefined,
    },
    {
      href: "/admin/crm/commercial",
      label: "Dashboard commerciale",
      description: "KPI revenue, audit, opportunity, azioni",
    },
    {
      href: "/admin/audit/digital",
      label: "Audit digitale",
      description: "Prospect P.IVA e report clienti",
    },
    {
      href: "/admin/inbox",
      label: "Action Inbox",
      description: "Priorità operative unificate",
    },
    {
      href: "/admin/crm/cross-sell",
      label: "Cross-sell",
      description: "10 query upsell predefinite",
    },
    {
      href: "/admin/documents",
      label: "Documenti",
      description: "Audit PDF, Drive, preventivi",
    },
    {
      href: "/admin/economics",
      label: "Economics",
      description: "Margini per brand",
    },
    {
      href: "/admin/posts?status=PENDING",
      label: "Contenuti in coda",
      description: "Post in attesa cliente",
      badge: pendingPosts > 0 ? pendingPosts : undefined,
    },
  ];

  return (
    <Card className="border-border/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Accesso rapido</CardTitle>
        <CardDescription>Moduli commerciali e operativi più usati.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((item) => (
          <Button
            key={item.href}
            asChild
            variant="outline"
            className="h-auto flex-col items-start gap-1 whitespace-normal py-3 text-left"
          >
            <Link href={item.href}>
              <span className="flex w-full items-center justify-between gap-2 font-medium">
                {item.label}
                {item.badge ? (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    {item.badge}
                  </span>
                ) : null}
              </span>
              <span className="text-xs font-normal text-muted-foreground">{item.description}</span>
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
