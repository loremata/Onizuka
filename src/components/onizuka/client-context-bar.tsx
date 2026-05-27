import { ClientLink } from "@/components/onizuka/client-link";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Props = {
  clientId: string;
  companyName: string;
  vatNumber?: string | null;
  contactEmail?: string | null;
};

/** Riga contesto cliente riusabile in opportunità, preventivi, audit figli. */
export function ClientContextBar({ clientId, companyName, vatNumber, contactEmail }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/30 px-4 py-2 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-xs font-medium uppercase text-muted-foreground">Cliente</span>
        <ClientLink clientId={clientId} name={companyName} />
        {vatNumber ? <span className="text-xs text-muted-foreground">P.IVA {vatNumber}</span> : null}
        {contactEmail ? <span className="text-xs text-muted-foreground">{contactEmail}</span> : null}
      </div>
      <Button asChild variant="outline" size="sm" className="h-8">
        <Link href={`/admin/clients/${clientId}`}>Scheda 360°</Link>
      </Button>
    </div>
  );
}
