import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { loadApprovalQueue } from "@/lib/approval-queue";
import { getOwnerReachAbDefaultVariant } from "@/lib/reach-ab-default";
import { isSmtpConfigured } from "@/lib/smtp-send";
import { AdminPageHeader } from "@/components/onizuka/admin-page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ApprovalQueueList } from "./approval-queue-list";

export default async function ApprovalQueuePage() {
  const session = await requireAdminArea();
  const [items, reachAbDefault] = await Promise.all([
    loadApprovalQueue(session.user.id),
    getOwnerReachAbDefaultVariant(session.user.id),
  ]);
  const smtpConfigured = isSmtpConfigured();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Coda approvazioni"
        lead="L'AI prepara · Lorenzo approva · Onizuka esegue. Email, preventivi e contenuti in attesa."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/reach">Reach</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>In attesa</CardTitle>
          <CardDescription>
            {items.length === 0
              ? "Nessuna voce in coda. Dopo un audit P.IVA compaiono email e preventivo bozza."
              : `${items.length} elementi da revisionare, raggruppati per tipo.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/audit/digital">Avvia audit digitale</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin">Comando P.IVA</Link>
              </Button>
            </div>
          ) : (
            <ApprovalQueueList
              items={items}
              smtpConfigured={smtpConfigured}
              reachAbDefault={reachAbDefault ?? "A"}
            />
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Email: Approva e Invia (SMTP o client mail) direttamente da questa pagina · Modifica in Reach · Preventivi e post si aprono nel modulo dedicato.
      </p>
    </div>
  );
}
