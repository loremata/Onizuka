import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { loadClientDocumentsHub } from "@/lib/client-documents-hub";
import { AdminPageHeader } from "@/components/onizuka/admin-page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const kindLabel = {
  audit_pdf: "Report audit",
  drive: "Google Drive",
  quote: "Preventivo",
  payout: "Liquidazione partner",
  ticket_attachment: "Allegato ticket",
} as const;

export default async function DocumentsHubPage() {
  const session = await requireAdminArea();
  const docs = await loadClientDocumentsHub(session.user.id);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Documenti"
        lead="Hub unificato: report audit, cartelle Drive, preventivi e allegati ticket."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/drive">Drive clienti</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Archivio recente</CardTitle>
          <CardDescription>{docs.length} voci aggregate da Onizuka.</CardDescription>
        </CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun documento indicizzato ancora.</p>
          ) : (
            <ul className="divide-y divide-border">
              {docs.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {kindLabel[d.kind]}
                    </p>
                    <p className="font-medium">{d.title}</p>
                    <p className="text-muted-foreground">{d.clientName}</p>
                  </div>
                  {d.url ? (
                    <Button asChild size="sm" variant="secondary">
                      <Link
                        href={d.url}
                        target={d.url.startsWith("http") ? "_blank" : undefined}
                        rel={d.url.startsWith("http") ? "noreferrer" : undefined}
                      >
                        Apri
                      </Link>
                    </Button>
                  ) : d.clientId ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/clients/${d.clientId}`}>Cliente</Link>
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
