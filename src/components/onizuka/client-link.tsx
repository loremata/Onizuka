import Link from "next/link";
import { cn } from "@/lib/utils";

type LinkProps = {
  clientId: string;
  name: string;
  className?: string;
};

/** Link canonico alla scheda cliente 360° (`/admin/clients/[id]`). */
export function ClientLink({ clientId, name, className }: LinkProps) {
  return (
    <Link
      href={`/admin/clients/${clientId}`}
      className={cn("font-medium text-primary hover:underline", className)}
    >
      {name}
    </Link>
  );
}

type LeadLinkProps = {
  leadId: string;
  name: string;
  className?: string;
};

export function LeadLink({ leadId, name, className }: LeadLinkProps) {
  return (
    <Link
      href={`/admin/crm/leads/${leadId}/edit`}
      className={cn("font-medium text-primary hover:underline", className)}
    >
      {name}
    </Link>
  );
}

type EntityClientProps = {
  clientId?: string | null;
  clientName?: string | null;
  leadId?: string | null;
  leadName?: string | null;
  fallback?: string;
  className?: string;
};

/** Mostra cliente o lead con link; testo neutro se assente. */
export function EntityClientLabel({
  clientId,
  clientName,
  leadId,
  leadName,
  fallback = "—",
  className,
}: EntityClientProps) {
  if (clientId && clientName) {
    return <ClientLink clientId={clientId} name={clientName} className={className} />;
  }
  if (leadId && leadName) {
    return <LeadLink leadId={leadId} name={leadName} className={className} />;
  }
  return <span className={cn("text-muted-foreground", className)}>{fallback}</span>;
}
